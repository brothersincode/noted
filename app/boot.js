
var remote = require('remote') // https://github.com/atom/electron/blob/master/docs/api/remote.md

	__        = require('underscore'),
	NProg     = require('nprogress'), //http://tutorialzine.com/2013/09/quick-tip-progress-bar/
	treeui    = require('treeui'), // https://github.com/tmcw/treeui
	yaml      = require('js-yaml'), // https://github.com/nodeca/js-yaml
	yamlFront = require('yaml-front-matter'), // https://github.com/dworthen/js-yaml-front-matter


	shell     = require('shell'), // https://github.com/atom/electron/blob/master/docs/api/shell.md
	ipc       = require('ipc'); // https://github.com/atom/electron/blob/master/docs/api/ipc-renderer.md


var win      = remote.getCurrentWindow(),
	fs       = remote.require('fs'),
	util     = require('util'),
	path     = remote.require('path'),
	dialog   = remote.require('dialog'),

	Menu     = remote.require('menu'),
	MenuItem = remote.require('menu-item'),
	BrowserWindow = remote.require('browser-window'),

	// toc    = remote.require('mdast-toc'), // https://github.com/wooorm/mdast-toc
	marked   = remote.require('marked'); // https://github.com/chjj/marked

var notedRenderer = function(){
	var app = this;
	this.config = null;
	this.absPath = null;
	this.file = null;
	this.debug = null;

	this.treeMenu    = null;
	this.nodeClicked = null;
	this.tabActive   = null;
	this.fileData    = null;
	this.fileFrontMatter  = {};

	this.$ = function(id, scope){
		return (scope || document).getElementById(id);
	};

	// https://github.com/atom/electron/blob/master/docs/tutorial/desktop-environment-integration.md#progress-bar-in-taskbar-windows--unity
	this.progressStart = function(id){
		NProg.start();
		return this;
	};

	this.progressDone = function(id){
		NProg.done();
		return this;
	};

	this.html = function(id, text){
		app.$(id).innerHTML = text;
		return this;
	};

	this.val = function(id, text){
		app.$(id).value = text;
		return this;
	};

	this.hC = function (ele,cls) {
		return app.$(ele).className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
	}

	this.aC = function(ele,cls) {
		if (!app.hC(ele,cls)) app.$(ele).className += " "+cls;
		return this;
	}

	this.rC = function(ele,cls) {
		if (app.hC(ele,cls)) {
			var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
			app.$(ele).className=app.$(ele).className.replace(reg,' ');
		};
		return this;
	}

	this.ce = function(_, k) {
		var elem = document.createElement(_);
		if (k) elem.className = k;
		return elem;
	};

	this.append = function(x, y) {
		return x.appendChild(y);
	};

	this.ae = function(x, y, z) {
		return x.addEventListener(y, z);
	};

	// SEE: https://nodejs.org/api/util.html#util_util_debuglog_section
	this.log = function(row){
		//if( this.debug )
			console.log(row);
		return this;
	};

	this.inspect = function(obj){
		//if( this.debug )
			console.log(util.inspect(obj, false, null));
		return this;
	};


	// https://github.com/atom/electron/blob/master/docs/api/dialog.md
	// dialog.showErrorBox('title', 'message');
	// dialog.showOpenDialog({properties: [ 'openFile', 'openDirectory', 'multiSelections' ]})

	this.notify = function(text){
		app.html('notification', text);
		return this;
	};

	this.dispatch = function(){
		app.progressStart();
		ipc.send( 'noted.app.booted', true );

		ipc.on( 'noted.app.init', function( reponse ) {
			app
				.log('Renderer Catched: noted.app.init')
				.init(reponse)
				.progressDone();
		});


		return this;
	};

	// https://github.com/atom/electron/blob/master/docs/api/menu.md
	// https://github.com/atom/electron/blob/master/docs/api/menu-item.md
	// https://github.com/atom/electron/blob/master/docs/api/accelerator.md
	// https://github.com/atom/atom/blob/master/src/browser/context-menu.coffee
	// https://discuss.atom.io/t/contextmenu-and-atom-menu/16353
	this.initMenus = function(){
		this.treeMenu = new Menu();
		this.mainMenu = new Menu();

		// USE: http://codyhouse.co/gem/css-slide-in-panel/
		this.treeMenu.append(new MenuItem({
			label: 'Preview',
			click: function() {
				app.log(app.nodeClicked);
				//console.log('item 1 clicked');
			}
		}));

		this.treeMenu.append(new MenuItem({
			label: 'Load',
			click: function() {
				if ( 'file' == app.nodeClicked.type ) {
					app.fetch(app.nodeClicked.path);
				}
			}
		}));

		this.treeMenu.append(new MenuItem({
			label: 'Load in New Tab',
			click: function() {
				if ( 'file' == app.nodeClicked.type ) {
					app.fetch(app.nodeClicked.path, null);
				}
			}
		}));

		this.treeMenu.append(new MenuItem({
			type: 'separator'
		}));

		this.treeMenu.append(new MenuItem({
			label: 'M2enuItem2',
			type: 'checkbox',
			checked: true
		}));

		this.mainMenu.append(new MenuItem({
			label: 'M1enuItem1',
			click: function() {
				console.log('item 1 clicked');
			}
		}));

		this.mainMenu.append(new MenuItem({
			type: 'separator'
		}));

		this.mainMenu.append(new MenuItem({
			label: 'M1enuItem2',
			type: 'checkbox',
			checked: true
		}));

		window.addEventListener('contextmenu', function (e) {
			e.preventDefault();

			app.mainMenu.popup(win);
		}, false);

		$('#storage').bind('tree.contextmenu', function(event) {
			var node = event.node;
			app.nodeClicked = event.node;

			//app.log(event);
			//alert(node.name);
			//app.inspect( event );
			app.treeMenu.popup(win);

		});
	};

	this.init = function(config) {
		this.config = config;
		this.debug = config.debug||false;

		app
			.rtl(config.rtl||false)
			// .log(config)
			.initDev()
			;

		this.rootPath = path.resolve( __dirname, '../..', config.root||'storage' );

		ipc.send( 'noted.dir.init', this.rootPath );
		ipc.on( 'noted.dir.list', function( reponse ) {
			app
				.log('Renderer Catched: noted.dir.list')
				.dir(reponse)
				//.treeui()
				.initMenus();
		});

		ipc.on( 'noted.app.rtl', function( reponse ) {
			app.rtl(reponse);
		});


		ipc.on( 'noted.watch.data', function( reponse ) {
			//app.log(reponse);
		});

		app.val('location', config.default||'example.md');

		app.$('location').onkeyup = function(event) {
			if (event.keyCode == 13) {
				app.fetch(event.target.value);
			};
		};

		app.$('save').onclick = function() {
			app
				.progressStart()
				.log('Renderer Trigged: noted.save')
				.save()
				.progressDone();
		};

		app.$('reload').onclick = function() {
			app.fetch(app.$('location').value);
		};

		app.$('reload-styles').onclick = function() {
			app.reloadStyles();
		};

		app.$('front-matter').onclick = function() {
			if( app.config.author )
				app.frontMatter('author', app.config.author);
			if( app.config.email )
				app.frontMatter('email', app.config.email);
		};

		// app.$('md-input').onkeyup = function() {
		// 	app
		// 		//.log('Renderer Trigged: input.onkeyup')
		// 		.md();
		// };

		app.$('md-input').onkeyup = __.debounce(app.md, 300); // http://underscorejs.org/#debounce

		app.$('print').onclick = function() {
			app
				//.log('Renderer Trigged: input.print()')
				.print();
		};

		// fired when a tree node is double-clicked
		$('#storage').bind('tree.dblclick', function(event) {
			//app.log(event.node);

			if ( 'file' == event.node.type ) {
				app.fetch(event.node.path);
			};
		});

		// bind 'tree.click' event
		$('#storage').bind('tree.click', function(event) {
			// The clicked node is 'event.node'
			//var node = event.node;
			//app.log(event);
			//event.preventDefault();
			//app.inspect( event );
		});

		// https://github.com/atom/electron/blob/master/docs/api/file-object.md
		app.$('md-input').ondragover = function () {
			return false;
		};

		app.$('md-input').ondragleave = app.$('md-input').ondragend = function () {
			return false;
		};

		app.$('md-input').ondrop = function (e) {
			e.preventDefault();

			var file = e.dataTransfer.files[0];
			app.fetch(file.path);

			return false;
		};

		//document.onclick = function(e) {
		app.$('md-output').onclick = function(e) {
			e.preventDefault();
			if (e.target.tagName == 'A')
				shell.openExternal(e.target.href);
			return false;
		};

		marked.setOptions({
			renderer: new marked.Renderer(),
			gfm: true,
			tables: true,
			breaks: false,
			pedantic: false,
			sanitize: false,
			smartLists: true,
			smartypants: false
		});

		return this;
	};

	this.fetch = function( file, container ){

		app
			.progressStart()
			.log('Renderer Trigged: noted.locate')
			.log('File you dragged here is', file)
			.locate(file)
			.load(container)
			.progressDone();

		return this;
	};

	this.locate = function( file ) {
		this.file = file;

		if (!file) {
			app.notify('location not specified!');
			return this;
		}

		var absPath = path.resolve(this.rootPath, file);

		if (!fs.existsSync(absPath)) {
			app.notify('location not exist!');
			return this
		}

		this.absPath = absPath;
		return this;
	};

	this.load = function(container) {

		if ( container === undefined )
			container = 'md-input';
		else if ( container == null )
			container = app.newTab();

		if (this.absPath) {

			this.fileData = yamlFront.loadFront(fs.readFileSync(this.absPath, 'utf-8'));

			app
				.val('location', this.absPath)
				// .val(container, fs.readFileSync(this.absPath, 'utf-8'))
				.val(container, this.fileData.__content.trim())
				.md()
				//.log(this.fileData)
				.notify('"' + this.file + '" loaded');

			var frontMatter = this.fileData;
			delete frontMatter.__content;
			this.fileFrontMatter = frontMatter;
			app.log(this.fileFrontMatter);
		}

		return this;
	};

	// FIXME: NOT IMPLEMENTED YET!
	this.newTab = function(){
		this.tabActive = null;
		return 'md-input';
	};

	this.save = function() {
		if (this.absPath) {
			var content = '';

			// var frontMatter = '---\npost: title one\n';
			// input += 'anArray:\n - one\n - two\n';
			// input += 'subObject:\n prop1: cool\n prop2: two';
			// input += '\nreg: !!js/regexp /pattern/gim';
			// input += '\nfun: !!js/function function() {  }\n---\n';
			// input += 'content\nmore';

			if ( this.fileFrontMatter.length != 0 ) {
				content += '---\n';
				content += yaml.safeDump(this.fileFrontMatter);
				content += '---\n';
			}

			app
				//.log(this.fileFrontMatter)
				.log(content);

			content += app.$('md-input').value;
			fs.writeFileSync(this.absPath, content);

			app.notify('"' + this.file + '" saved');
		}
		return this;
	};

	this.frontMatter = function(key, data){
		if (this.debug.frontMatter||true) {
			this.fileFrontMatter[key] = data;
		}
		return this;
	};

	this.md = function(){
		app
			.html('md-output', marked(app.$('md-input').value))
			.log('Renderer Trigged: noted.md');
		return this;
	};

	this.dir = function(data){
		this.data = data;

		$('#storage').tree({
			data: this.data.children,
			dragAndDrop: true,
			//closedIcon: '+',
			//closedIcon: $('&lt;i class="fa fa-arrow-circle-right"&gt;&lt;/i&gt;'),
			//openedIcon: $('&lt;i class="fa fa-arrow-circle-down"&gt;&lt;/i&gt;'),

			// https://mbraak.github.io/jqTree/examples/06_autoescape.html

			// https://mbraak.github.io/jqTree/examples/09_custom_html.html
			o1nCreateLi: function(node, $li) {
				// Append a link to the jqtree-element div.
				// The link has an url '#node-[id]' and a data property 'node-id'.
				$li.find('.jqtree-element').append(
					'<a href="#node-'+ node.id +'" class="edit" data-node-id="'+ node.id +'">edit</a>'
				);
			}
		});

		app.log('Renderer Trigged: noted.dir()');
		return this;
	};

	// https://github.com/atom/electron/blob/master/docs/api/browser-window.md#browserwindowprintoptions
	// https://developer.mozilla.org/en-US/docs/Printing
	this.print = function() {
		// app
			// .log('Renderer Trigged: noted.print()')
			// .$('md-output').print();


		// http://stackoverflow.com/questions/16894683/how-to-print-html-content-on-click-of-a-button-but-not-the-page
		// w=window.open();
		// w.document.write('<html>'+app.$('md-output').innerHTML+'</html>');
		// w.print();
		// w.close();

		// var printWin = window.open('','','left=0,top=0,width=1,height=1,toolbar=0,scrollbars=0,status  =0');
		// printWin.document.write('<html>'+app.$('md-output').innerHTML+'</html>');
		   // printWin.document.close();
		   // printWin.focus();
		   // printWin.print();
		   // printWin.close();

		return this;
	};

	this.rtl = function(isRTL){
		this.isRTL = isRTL;
		if ( this.isRTL )
			app.aC('bbooddyy','rtl').log('Body is RTL');
		else
			app.rC('bbooddyy','rtl').log('Body is NOT RTL');

		return this;
	};

	this.about = function(){
		var win = new BrowserWindow({ width: 800, height: 600, frame: false });
		win.loadUrl('https://github.com');

		return this;
	};

	// https://github.com/tmcw/treeui
	this.treeui = function(){

		treeui(app.request).onclick(function(level) {
			app.log('treeui:level: '+level);
		}).appendTo(app.$('md-output'));

		return this;
	};

	this.request = function(tree, callback){
		app.log(tree).log(callback);
		callback(null, [1 + tree, 2 + tree, 3 + tree]);
		return this;
	};

	this.initDev = function(){
		//if ( !this.debug )
			//return this;

		return this;
	};

	this.reloadStyles = function(){
		//if ( !this.debug )
			//return this;

		// BUG
		// http://stackoverflow.com/a/13721261/4864081
		// var links = document.getElementsByTagName("link");
		// for (var x in links) {
		//     var link = links[x];
		//
		//     if (link.getAttribute("rel").indexOf("stylesheet") > -1) {
		//         link.href = link.href + "?id=" + new Date().getMilliseconds();
		//     }
		// }

		// var links = document.getElementsByTagName("link");
		// for (var i = 0; i < links.length;i++) {
		// 	var link = links[i];
		// 	if (link.rel === "stylesheet") {
		// 		link.href += "?id=" + new Date().getMilliseconds();
		// 	}
		// }

		// http://stackoverflow.com/a/25605372/4864081
		var toAppend = "id=" + (new Date()).getTime();
		var links = document.getElementsByTagName("link");
		for (var i = 0; i < links.length;i++) {
			var link = links[i];
			if (link.rel === "stylesheet") {
				if (link.href.indexOf("?") === -1) {
					link.href += "?" + toAppend;
				} else {
					if (link.href.indexOf("id") === -1) {
						link.href += "&" + toAppend; } else {
							link.href = link.href.replace(/id=\d{13}/, toAppend)}
				};
			}
		}


		return this;
	};

	return this;
};

var noted = new notedRenderer();

ipc.on('noted.app.start', function(message) {
	noted.dispatch();
});

//win.on('close', function() {});
