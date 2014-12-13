var q = require('q');
var channelSeed = 0;

//shallow clone
function clone(obj) {
    if (typeof obj === "object") {
        var target = {};
        for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
                target[i] = obj[i];
            }
        }
        return target;
    }
}


function topicHandler(topic) {
    var t = topic.split('#');
    return {
        to: t[0],
        hash: t[1]
    }
}


function init() {

    var name = channelSeed++,
        subscriptions = {},
        filters = {},
        forwards = {};

    //subscribes a function to a topic
    function subscribe(topic, func) {
        var t = topicHandler(topic);
        if (!subscriptions[t.to]) {
            subscriptions[t.to] = [];
        }
        subscriptions[t.to].push({
            hash: t.hash,
            func: func
        });
    }

    //clears the topic
    function unsubscribe(topic) {
        var t = topicHandler(topic);
        if (!t.hash) {
            if (subscriptions[t.to] && (subscriptions[t.to].length > 0)) {
                subscriptions[t.to] = [];
            }
        } else {
            subscriptions[t.to] = subscriptions[t.to].filter(function (s) {
                return s.hash !== t.hash;
            });
        }
    }

    //publishes in topic
    function publish(topic, input) {
        var t = topicHandler(topic);

        return q(true).then(function () {
            var data = (input) ? clone(input) : {};
            var promiseArgs = q(data);
            if (filters[t.to] && filters[t.to].length > 0) {
                filters[t.to].forEach(function (args, filter) {
                    promiseArgs = promiseArgs.then(filter);
                });
            }
            return promiseArgs;
        }).then(function (data) {
            var todos = [];
            if (subscriptions[t.to] && subscriptions[t.to].length > 0) {
                //call subscribers
                todos = todos.concat(subscriptions[t.to].filter(function (subber) {
                    return (!subber.hash || subber.hash === t.hash);
                }).map(function (subber) {
                    return subber.func(data);
                }));
            }
            for (var ch in forwards) {
                //TODO, this is kinda inconsequent, resolutions from there are going to be returned as arrays
                //but at least error handling is ok.
                todos.push(forwards[ch].publish(topic, input));
            }
            return q.all(todos);
        });

    }

    //register a filter function that gets called the same way as a subscribtion handler, but has to resolve to arguments that are supposed to be passed on
    //if filter function throws, the publish is instantly cancelled
    function filter(what, filter) {
        if (!filters[what]) {
            filters[what] = [];
        }
        filters[what].push(filter);
    }

    function forwardTo(chan) {
        if (chan.name !== name) {
            forwards[chan.name] = chan;
        }
    }

    function dropForward(chan) {
        if (chan.name !== name) {
            delete forwards[chan.name];
        }
    }


    function destroy() {
        subscriptions = {};
        filters = {};
        forwards = {};
    }

    return {
        publish: publish,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        filter: filter,
        forwardTo: forwardTo,
        dropForward: dropForward,
        name: name,
        destroy: destroy
    };

}

var globalSubscribtions = init();

module.exports = {
    promises: q,
    newChannel: init,
    global: globalSubscribtions
};