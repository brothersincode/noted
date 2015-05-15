var gulp    = require('gulp'),
	sass    = require('gulp-sass'),
	plumber = require('gulp-plumber'),
	notify  = require('gulp-notify');

// gulp.task('default', function(){
    // console.log('default gulp task...')
// });

var plumberErrorHandler = { errorHandler: notify.onError({
    title: 'Gulp',
    message: 'Error: <%= error.message %>'
  })
};

gulp.task('watch', function() {

  gulp.watch('./root/assets/stylesheets/**/*.scss', ['sass']);
  //gulp.watch('./root/assets/stylesheets/*.scss', ['sass']);

  //gulp.watch('js/src/*.js', ['js']);

  //gulp.watch('img/src/*.{png,jpg,gif}', ['img']);

});

gulp.task('sass', function () {

	gulp.src('./root/assets/stylesheets/style.scss')

	.pipe(plumber(plumberErrorHandler))

	.pipe(sass({
      includePaths: require('node-neat').includePaths
      // includePaths: require('node-bourbon').with('other/path', 'another/path')
    }))

    .pipe(gulp.dest('./root/assets/css'));
});

gulp.task('default', ['sass', 'watch']);
