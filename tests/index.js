var axons = require('../');


axons.global.define.transform(function (fi) {
    fi.transform('test', function (a) {
        console.log('fil: ', a);
        return a;
    })

});

axons.global.define.subscriber(function (sub) {
    sub.subscribe('test', function watcherSub(data) {
        console.log('sub: ', data);
        return sub.promises();
    });
});

axons.global.define.publisher(function (pub) {
    console.log('pub: ');
    pub.publish('test', {
        foo: 'bar'
    }).done();
});