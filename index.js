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

function identity(i) {
    return i;
}

function getByTopic(collection, topic) {
    var parentTopic = topic.replace(/\.[^.]+$/, '');
    return [].concat(collection[topic], (topic !== parentTopic ? getByTopic(collection, parentTopic) : [])).filter(identity);
}



function init() {

    var name = channelSeed++,
        subscriptions = {},
        filters = {},
        forwards = {};

    //subscribes a function to a topic
    function subscribe(topic, func) {
        if (!subscriptions[topic]) {
            subscriptions[topic] = [];
        }
        subscriptions[topic].push({
            func: func
        });
    }

    //clears the topic
    function unsubscribeAll(topic) {
        if (subscriptions[topic]) {
            subscriptions[topic] = [];
        }
    }

    //publishes in topic
    function publish(topic, input) {

        var selectedFilters = getByTopic(filters, topic);
        var selectedSubs = getByTopic(subscriptions, topic);

        return q(true).then(function () {
            var data = (input) ? clone(input) : {};
            var promiseArgs = q(data);
            selectedFilters.forEach(function (filter) {
                promiseArgs = promiseArgs.then(filter);
            });
            return promiseArgs;
        }).then(function (data) {
            var todos = [];
            //call subscribers
            todos = todos.concat(selectedSubs.map(function (subber) {
                return subber.func(data);
            }));
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

    function mkDef(api) {
        return function (definition) {
            return definition(api);
        }
    }

    return {
        define: {
            publisher: mkDef({
                publish: publish,
                promises: q
            }),
            subscriber: mkDef({
                subscribe: subscribe,
                unsubscribeAll: unsubscribeAll,
                promises: q
            }),
            filter: mkDef({
                filter: filter,
                promises: q
            })
        },
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