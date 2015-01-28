axons.js
========

A code organisation and decoupling pattern for your promise chains (inspired the good old pub-sub).

Works with node, browserify and in the browser, standalone (see dist folder). Can be shimmed to work with AMD module loaders.
In the browser it comes with a built-in tiny implementation of promises with `then`, `fail`, `defer` and `all` methods we all know and like. 

## The pattern

Axons implement a pattern that is applicable for regulating a flow that starts with a single cause and, after some processing, has one or multiple subsequent effects.

### Intuition

*Imagine a publisher-subscriber library. Imagine it works with promises, so every subscriber returns a promise, and the `.publish` method returns a promise that aggregates all of those. Now add a transformation step in the middle, so the published information can be enhanced or filtered before it reaches subscribers. That's about it.*

So publisher is the origin of a thought and subscribers are the muscles. 

### Flow elements

```
                                      | - sub1
pub --> trans1 --> trans2 --> mod --> | - sub2
                                      | - sub3
```

**topic** is a string passed as the first argument to the `.publish` call. All flow elements are assigned to topics. Topics can have a hierarchy coded with dots, so "event.mouse.click" and "event.mouse.drag" are topics from the same hierarchy. 
A transform or a subscriber for "event.mouse" or "event" would be called for both topics. Moderator requires the topic to match exactly.


**publisher** has access to the `.publish` method, can publish in a topic and get a promise, that resolves to success or fails with any error that happened in subsequent flow elements and didn't get handled. Successful resolution can be an array of promise resolutions from subscribers, or a `Termination` object returned by the moderator.
*A publisher should be responsible for handling a single event source, publishing to the right topics and handling uncaught errors + reacting to terminations if needed.*

**transform** is a function accepting one argument - the published data. Transform has to return the data object (or a promise for the data object) with any modifications it wishes to make. There can be multiple transforms for a single topic and they are running in a sequence.
*A transform is responsible for fetching additional information that moderator or subscribers need to do their job. It can be a http/DB request. It's recommended to have a separate transform for every information that has to be fetched asynchronously.*

**moderator** is a function accepting one argument - the published data after all transformations are done. There can be only one moderator for a topic. Moderator can return a string that will be apended as a next word at the end of the topic. Moderator can return a Termination object that will report back to publisher without ever running the subscribers. If moderator returns falsy, it's like it wasn't even there.
*The moderator is responsible for deciding, based on data fetched by transforms, if the control flow should be redirected somehow. It can be done by appending to the topic or terminating. This is really useful if data available to the publisher is not enough to make decisions. It's recommended to only put decision logic in moderator, but it can return a promise if needed.*

**subscriber** is just doing what is needed with the data. All subscribers to a topic are running concurrently (as in `q.all`)
*A subscriber should perform an operation (or a sequence of operations) based on the data that it receives. It's recommended that all data is fetched by transforms and subscriber doesn't have to make any get-alike requests*

Every flow element is defined in a way that makes it uncomfortable to break the pattern and make one module behave like two different flow elements. 



## API

Create a channel:
```javascript
var channel1 = axons.newChannel()
```
Or use the global channel `axons.global`


```javascript
CHANNEL.define.publisher(function (api) {
    api.publish(TOPIC, DATA) //publishes DATA to TOPIC
});
```

```javascript
CHANNEL.define.transformcontrolHandler(function (api) {
    //registers a transform on a TOPIC 
    api.transform(TOPIC, function (data) {  
        //modify data
        return data;                       //return a promise or a value
    }, ORDER)           //order of the transforms sequence is established by sorting ORDER values. 
    //Default ORDER value is 0
});
```

```javascript
CHANNEL.define.moderator(function (api) {
    //registers a transform on a TOPIC 
    api.moderator(TOPIC, function (data, Termination) {  
        return "more";                               //return string to be added to the topic
        return new Termination(REASON);              //return a termination to skip running subscribers
    })                       
});
```

```javascript
CHANNEL.define.subscriber(function (api) {
    //registers a subscriber on a TOPIC 
    api.subscribe(TOPIC, function (data) {  

    })     
    //removes all subscribers to given topic. shouldn't be needed, but just in case.
    api.unsubscribeAll(TOPIC)      
});
```


```javascript
CHANNEL.report(function debuglogging(data) {  
    //data.report is a string containing an overview of what happened. 
    console.log(data.report);
    //data.error is an error object if an error occured
    if(data.error){
        console.error(data.error.stack);
    }
});
```


`axons.Termination` - Termination constructor to use with `instanceOf`. If publisher is supposed to react to a termination, it can do so by checking if the result is an instance of Termination, not an array.

`axons.promises` holds the built-in promise implementation. Also available as `api.promises` in every flow element definition.
Built-in promises include implementations of:
 - promises().then
 - promises().fail
 - promises.defer
 - promises.all
Functionality of those matches `kriskoval/q`








