module.exports = function (grunt) {
    var package = grunt.file.readJSON("package.json");

    grunt.initConfig({
        pkg: package,
        clean: ["dist"],
        browserify: {
            dist: {
                files: {
                    "dist/axons.js": ["index.js"]
                },
                options: {
                    plugin: ['bundle-collapser/plugin'], //a tool from substack himself
                    browserifyOptions: {
                        fullPaths: false,
                        insertGlobals: false,
                        detectGlobals: false, //globals from node - sometimes you don't need them
                        standalone: "<%=pkg.name %>" //works now
                    }
                }
            }
        },

        uglify: {
            options: {
                report: "gzip", //only shows with --verbose in current version
                banner: "// <%= pkg.name %> v<%= pkg.version %> \n" +
                    "// license:<%= pkg.license %> \n" +
                    "// <%= pkg.author %> \n" +
                    "// built <%= grunt.template.today('yyyy-mm-dd') %> \n" //remember the newline! :)
            },
            dist: {
                files: [{
                    src: 'dist/*.js', // source files mask
                    dest: 'dist/', // destination folder
                    expand: true, // allow globbing src
                    flatten: true, // remove all unnecessary nesting
                    ext: '.min.js' // replace .js to .min.js
                }]
            }
        }

    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-uglify");

    grunt.registerTask("build", ["clean", "browserify", "uglify"]);

    grunt.registerTask("default", ["build"]);

}