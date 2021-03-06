var axons = require('../');


axons.global.report(function debg(data) {
    console.log(data.report);
});

axons.global.define.transform(function (tr) {
    console.log("expect 43120");
    tr.transform('test.case', function (a) {
        console.log('inside transform 0: ', a);
        return a;
    }, 2)
    tr.transform('test', function (a) {
        console.log('inside transform 1: ', a);
        return a;
    }, -1)
    tr.transform('test.case', function (a) {
        console.log('inside transform 2: ', a);
        a.baz = 2;
        return a;
    })
    tr.transform('test', function (a) {
        console.log('inside transform 3: ', a);
        return a;
    }, -2)
    tr.transform('test.case', function (a) {
        console.log('inside transform 4: ', a);
        return a;
    }, -3)

});



axons.global.define.moderator(function (mod) {
    mod.moderator('test.case', function (data) {
        //appends to topic based on data
        return 'moderated';
    });

    mod.moderator('test.termination', function (data, Termination) {
        //appends to topic based on data
        return new Termination('reason!');
    });
});

axons.global.define.subscriber(function (sub) {
    sub.subscribe('test.case', function problematicSub(data) {
        console.log('inside subber 1: ', data);
        throw new Error('An error in subscriber');
        return sub.promises();
    });
    sub.subscribe('test', function justSub(data) {
        console.log('inside subber 2: ', data);
        return sub.promises();
    });
    sub.subscribe('test.case.moderated', function justSub(data) {
        console.log('inside subber 3: ', data);
        return sub.promises();
    }); 
    sub.subscribe('test.termination', function justSub(data) {
        console.log('THIS SHOULD NOT HAPPEN');
        return sub.promises();
    });

});

//publishers defined last as they don't wait for any events, but run publish straight away
axons.global.define.publisher(function (pub) {
    console.log('publishing!');
    pub.publish('test.case', {
        foo: 'bar'
    }).fail(function (e) {
        console.error(e);
        console.error(e.stack);
        console.log('data', e.data);
    });

    pub.publish('test.termination', {}).fail(function (e) {
        console.error(e);
        console.error(e.stack);
        console.log('data', e.data);
    });
});