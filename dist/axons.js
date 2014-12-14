!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.axons=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var q = require(2);
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
            selectedFilters.forEach(function (args, filter) {
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
},{}],2:[function(require,module,exports){
//wrapper for any promises library
var pinkySwear = require(3);

//for pinkyswear starting versions above 2.10
var createErrorAlias = function (promObj) {
    promObj.fail = function (func) {
        return promObj.then(0, func);
    };
    return promObj;
}

var Promises = function (value) {
    var promise = pinkySwear(createErrorAlias);
    promise(value);
    return promise;
}

Promises.defer = function () {
    var promise = pinkySwear(createErrorAlias);
    return {
        promise: promise,
        resolve: function (a) {
            promise(true, [a]);
        },
        reject: function (a) {
            promise(false, [a]);
        }
    };
}

function settler(array, resolver) {
    array.forEach(function (promise, num) {
        promise.then(function (result) {
            resolver(num, {
                state: "fulfilled",
                value: result
            });
        }, function (err) {
            resolver(num, {
                state: "rejected",
                reason: err
            });
        })
    });
}

Promises.all = function (array) {
    var deferAll = Promises.defer();
    var results = [];
    var counter = array.length;

    settler(array, function (num, item) {
        if (counter) {
            if (item.state === "rejected") {
                counter = 0;
                deferAll.reject(item.reason);
            } else {
                results[num] = item;
                if (--counter === 0) {
                    deferAll.resolve(results);
                }
            }
        }
    })
    return deferAll.promise;
}

Promises.allSettled = function (array) {
    var collectiveDefere = Promises.defer();
    var results = [];
    var counter = array.length;

    settler(array, function (num, item) {
        results[num] = item;
        if (--counter === 0) {
            collectiveDefere.resolve(results);
        }
    })

    return collectiveDefere.promise;
}

module.exports = Promises;
},{}],3:[function(require,module,exports){
/*
 * PinkySwear.js 2.2.2 - Minimalistic implementation of the Promises/A+ spec
 * 
 * Public Domain. Use, modify and distribute it any way you like. No attribution required.
 *
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 *
 * PinkySwear is a very small implementation of the Promises/A+ specification. After compilation with the
 * Google Closure Compiler and gzipping it weighs less than 500 bytes. It is based on the implementation for 
 * Minified.js and should be perfect for embedding. 
 *
 *
 * PinkySwear has just three functions.
 *
 * To create a new promise in pending state, call pinkySwear():
 *         var promise = pinkySwear();
 *
 * The returned object has a Promises/A+ compatible then() implementation:
 *          promise.then(function(value) { alert("Success!"); }, function(value) { alert("Failure!"); });
 *
 *
 * The promise returned by pinkySwear() is a function. To fulfill the promise, call the function with true as first argument and
 * an optional array of values to pass to the then() handler. By putting more than one value in the array, you can pass more than one
 * value to the then() handlers. Here an example to fulfill a promsise, this time with only one argument: 
 *         promise(true, [42]);
 *
 * When the promise has been rejected, call it with false. Again, there may be more than one argument for the then() handler:
 *         promise(true, [6, 6, 6]);
 *         
 * You can obtain the promise's current state by calling the function without arguments. It will be true if fulfilled,
 * false if rejected, and otherwise undefined.
 * 		   var state = promise(); 
 * 
 * https://github.com/timjansen/PinkySwear.js
 */
(function(target) {
	var undef;

	function isFunction(f) {
		return typeof f == 'function';
	}
	function isObject(f) {
		return typeof f == 'object';
	}
	function defer(callback) {
		if (typeof setImmediate != 'undefined')
			setImmediate(callback);
		else if (typeof process != 'undefined' && process['nextTick'])
			process['nextTick'](callback);
		else
			setTimeout(callback, 0);
	}

	target[0][target[1]] = function pinkySwear(extend) {
		var state;           // undefined/null = pending, true = fulfilled, false = rejected
		var values = [];     // an array of values as arguments for the then() handlers
		var deferred = [];   // functions to call when set() is invoked

		var set = function(newState, newValues) {
			if (state == null && newState != null) {
				state = newState;
				values = newValues;
				if (deferred.length)
					defer(function() {
						for (var i = 0; i < deferred.length; i++)
							deferred[i]();
					});
			}
			return state;
		};

		set['then'] = function (onFulfilled, onRejected) {
			var promise2 = pinkySwear(extend);
			var callCallbacks = function() {
	    		try {
	    			var f = (state ? onFulfilled : onRejected);
	    			if (isFunction(f)) {
		   				function resolve(x) {
						    var then, cbCalled = 0;
		   					try {
				   				if (x && (isObject(x) || isFunction(x)) && isFunction(then = x['then'])) {
										if (x === promise2)
											throw new TypeError();
										then['call'](x,
											function() { if (!cbCalled++) resolve.apply(undef,arguments); } ,
											function(value){ if (!cbCalled++) promise2(false,[value]);});
				   				}
				   				else
				   					promise2(true, arguments);
		   					}
		   					catch(e) {
		   						if (!cbCalled++)
		   							promise2(false, [e]);
		   					}
		   				}
		   				resolve(f.apply(undef, values || []));
		   			}
		   			else
		   				promise2(state, values);
				}
				catch (e) {
					promise2(false, [e]);
				}
			};
			if (state != null)
				defer(callCallbacks);
			else
				deferred.push(callCallbacks);
			return promise2;
		};
        if(extend){
            set = extend(set);
        }
		return set;
	};
})(typeof module == 'undefined' ? [window, 'pinkySwear'] : [module, 'exports']);


},{}]},{},[1])(1)
});