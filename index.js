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
        transforms = {},
        moderators = {},
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


        return q(true).then(function () {
            var selectedTransforms = getByTopic(transforms, topic);
            var data = (input) ? clone(input) : {};
            var promiseArgs = q(data);
            selectedTransforms.forEach(function (transform) {
                promiseArgs = promiseArgs.then(transform);
            });
            return promiseArgs;
        }).then(function (data) {
            if (moderator[topic]) {
                return q().then(function () {
                    return moderator[topic](topic, data);
                }).then(function (newTopic) {
                    topic = newTopic;
                    return data;
                })
            } else {
                return data;
            }
        }).then(function (data) {
            var selectedSubs = getByTopic(subscriptions, topic);
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

    //register a transform function that gets called the same way as a subscribtion handler, but has to resolve to arguments that are supposed to be passed on
    //if transform function throws, the publish is instantly cancelled
    function transform(what, transform) {
        if (!transforms[what]) {
            transforms[what] = [];
        }
        transforms[what].push(transform);
    }

    function moderator(what, moderator) {
        if (!moderators[what]) {
            moderators[what] = moderator;
        } else {
            throw new Error("There can be only one moderator for topic. " + what);
        }
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
        transforms = {};
        moderators = {};
        forwards = {};
    }

    function mkDef(api) {
        return function (definition) {
            api.promises = q;
            return definition(api);
        }
    }

    return {
        define: {
            publisher: mkDef({
                publish: publish
            }),
            subscriber: mkDef({
                subscribe: subscribe,
                unsubscribeAll: unsubscribeAll
            }),
            transform: mkDef({
                transform: transform
            }),
            moderator: mkDef({
                moderator: moderator
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