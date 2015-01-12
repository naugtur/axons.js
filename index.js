var q = require('q');
var channelSeed = 0;

//shallow clone
//TODO: consider replacing with better one
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

function mkDef(api) {
    return function (definition) {
        api.promises = q;
        return definition(api);
    }
}


function identity(i) {
    return i;
}

function topicRecur(collection, topic) {
    var parentTopic = topic.replace(/\.[^.]+$/, '');
    return [].concat(
        (topic !== parentTopic ? topicRecur(collection, parentTopic) : []),
        collection[topic]
    );
}

function getByTopic(collection, topic) {
    return topicRecur(collection, topic).filter(identity)
}

function rmItemFromArray(item, array) {
    return array.splice(array.indexOf(item), 1);
}

//Factory of functions that can be used for defining subscribers, transforms etc.
// that are in a 1 topic to many flowElements relation
function flowElementRegistererFactory(elementsCollection) { //#sojava
    return function defineFlowElement(topic, func, order) {
        if (!elementsCollection[topic]) {
            elementsCollection[topic] = [];
        }
        elementsCollection[topic].push({
            func: func,
            ord: order, //only used for transforms, but code-reuse is good, so subscribers have it too
            t: topic
        });
        return {
            drop: function () {
                elementsCollection[topic] = rmItemFromArray(elementsCollection, elementsCollection[topic])
            }
        }
    }
}

//Factory of functions that can be used for defining moderators etc.
// that are in 1 to 1 relation with a topic
function controlHandlerRegistererFactory(handlersCollection, name) {
    return function defineControlHandler(topic, controlHandler) {
        if (!handlersCollection[topic]) {
            handlersCollection[topic] = controlHandler;
            return {
                drop: function () {
                    if (handlersCollection[topic] === controlHandler) {
                        handlersCollection[topic] = null;
                    }
                }
            }
        } else {
            throw new Error("There can be only one " + name + " for topic. " + topic);
        }
    }

}

function Termination(reason) {
    this.reason = reason;
}

function init() {

    var name = channelSeed++,
        subscriptions = {},
        transforms = {},
        moderators = {},
        forwards = {},
        reporter;


    //publishes in topic
    function publish(topic, input) {
        var report = ['pub:' + topic];

        var data = (input) ? clone(input) : {};

        return q().then(function () {
            var selectedTransforms = getByTopic(transforms, topic).sort(function (a, b) {
                return (~~(a.ord) - ~~(b.ord)) //ascending
            });
            var promiseArgs = q(data);
            selectedTransforms.forEach(function (transform) {
                promiseArgs = promiseArgs.then(function (intermediateData) {
                    data = intermediateData;
                    reporter && report.push('tr:' + transform.t);
                    return transform.func(data);
                });
            });
            return promiseArgs;
        }).then(function (transformedData) {
            data = transformedData;
            if (moderators[topic]) {
                return q().then(function () {
                    return moderators[topic](data, Termination);
                }).then(function (moderationResult) {
                    if (moderationResult instanceof Termination) {
                        reporter && report.push('mod:' + topic + '=terminated');
                    } else {
                        reporter && report.push('mod:' + topic + '+.' + moderationResult);
                        topic = topic + '.' + moderationResult;
                    }
                    return moderationResult;
                })
            }
        }).then(function (moderationResult) {
            if (moderationResult instanceof Termination) {
                return moderationResult;
            }
            var selectedSubs = getByTopic(subscriptions, topic);
            var currentRepot, todos;
            if (reporter) {
                currentRepot = report.length;
                report[currentRepot] = 'subs: ';
                todos = selectedSubs.map(function (subber) {
                    return q(data).then(subber.func).then(function (a) {
                        report[currentRepot] += (subber.t + ';');
                        return a;
                    }, function (err) {
                        report[currentRepot] += (subber.t + '(!);');
                        throw err;
                    });
                });
            } else {
                todos = selectedSubs.map(function (subber) {
                    return q(data).then(subber.func);
                });
            }
            if (forwards.length > 0) {
                reporter && report.push('fwd:' + forwards.length);
                for (var ch in forwards) {
                    //TODO, this is kinda inconsequent, resolutions from there are going to be returned as arrays
                    //but at least error handling is ok.
                    todos.push(forwards[ch].publish(topic, input));
                }
            }


            return q.all(todos);

        }).then(function (resolutions) {
            reporter && reporter({
                report: '[ok] ' + report.join(" >> ")
            });
            return resolutions;
        }, function (err) {
            reporter && reporter({
                report: '[!!] ' + report.join(" >> ") + " (!)" + err,
                input: input,
                data: data,
                error: err
            });
            err.data = data;
            err.topic = topic;
            throw err;
        });

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



    //clears the topic
    function unsubscribeAll(topic) {
        if (subscriptions[topic]) {
            subscriptions[topic] = [];
        }
    }

    function destroy() {
        subscriptions = {};
        transforms = {};
        moderators = {};
        forwards = {};
    }


    return {
        name: name,
        report: function (func) {
            reporter = func;
        },
        define: {
            publisher: mkDef({
                publish: publish
            }),
            subscriber: mkDef({
                subscribe: flowElementRegistererFactory(subscriptions),
                unsubscribeAll: unsubscribeAll
            }),
            transform: mkDef({
                transform: flowElementRegistererFactory(transforms)
            }),
            moderator: mkDef({
                moderator: controlHandlerRegistererFactory(moderators, "moderator")
            })
        },
        forwardTo: forwardTo,
        dropForward: dropForward,
        destroy: destroy
    };

}

var globalSubscriptions = init();

module.exports = {
    promises: q,
    newChannel: init,
    global: globalSubscriptions
};