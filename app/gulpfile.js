var gulp    = require('gulp'),
	sass    = require('gulp-sass'),
	compass = require('gulp-compass'),
	plumber = require('gulp-plumber'),
	notify  = require('gulp-notify'),
	path    = require('path');

// gulp.task('default', function(){
    // console.log('default gulp task...')
// });

var plumberErrorHandler = { errorHandler: notify.onError({
    title: 'Gulp',
    message: 'Error: <%= error.message %>'
  })
};

gulp.task('watch', function() {

	gulp.watch('./root/assets/stylesheets/**/*.*', ['compass']);

	//gulp.watch('./root/assets/stylesheets/**/*.scss', ['sass']);
  //gulp.watch('./root/assets/stylesheets/*.scss', ['sass']);

  //gulp.watch('js/src/*.js', ['js']);

  //gulp.watch('img/src/*.{png,jpg,gif}', ['img']);

});

gulp.task('compass', function() {
  gulp.src('./root/assets/stylesheets/*.scss')
	.pipe(plumber(plumberErrorHandler))
    .pipe(compass({
      project: path.join(__dirname, 'root/assets'),
      css: 'css',
      sass: 'stylesheets'
    }))
    .pipe(gulp.dest('./root/assets/css'));
});

gulp.task('sass', function () {

	gulp.src('./root/assets/stylesheets/style.scss')

	.pipe(plumber(plumberErrorHandler))

	.pipe(sass({
      //includePaths: require('node-neat').includePaths
      // includePaths: require('node-bourbon').with('other/path', 'another/path')
    }))

    .pipe(gulp.dest('./root/assets/css'));
});

gulp.task('default', ['compass', 'sass', 'watch']);
