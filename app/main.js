
// https://github.com/atom/electron/tree/master/docs
// https://github.com/atom/electron/blob/master/docs/tutorial/quick-start.md

var app  = require('app'), // Module to control application life.
	ipc  = require('ipc'), // https://github.com/atom/electron/blob/master/docs/api/ipc-main-process.md

	path = require('path'), // https://nodejs.org/api/path.html
	fs   = require('fs'),
	util = require('util'),

	// dir  = require('node-dir'), // https://github.com/fshost/node-dir
	Watch = require('simple-treewatch'), // https://github.com/csabiftw/node-simple-treewatch
	mHTML = require('mhtml'), // https://github.com/balaclark/node-mhtml


	Tray          = require('tray'),
	Menu          = require('menu'), // https://github.com/atom/electron/blob/master/docs/api/menu.md
	MenuItem      = require('menu-item'), // https://github.com/atom/electron/blob/master/docs/api/menu-item.md
	BrowserWindow = require('browser-window'),  // Module to create native browser window.

	menu          = null,
	appIcon       = null, // https://github.com/atom/electron/blob/master/docs/api/tray.md
	mainWindow    = null; // Keep a global reference of the window object, if you don't, the window will be closed automatically when the javascript object is GCed.

var notedMain = function(){
	global.__base = __dirname + '/';

	var app       = this;

	this.electron = null;
	this.screen   = null;
	this.config   = null;
	this.storage  = null;
	this.debug    = null;
	this.rootPath = null;
	this.watch    = null;
	this.winAbout = null;

	this.log = function(row){
		if( this.debug )
			console.log(row);
		return this;
	};

	this.inspect = function(obj){
		if( this.debug )
			console.log(util.inspect(obj, false, null));
		return this;
	};

	this.initTray = function(){
		appIcon = new Tray(null);
		// appIcon.setImage('../resources/win/app.ico', false); // disable the behavior
		// appIcon = new Tray("./resources/win/app.ico");
		// appIcon.setPressedImage(path.join(__dirname, "./menu-bar-white.png"));

		var contextMenu = Menu.buildFromTemplate([
			{ label: 'Save from Clippord', type: 'radio' },
			{ label: 'Item2', type: 'radio' },
			{ label: 'Item3', type: 'radio', checked: true },
			{ label: 'Item4', type: 'radio' },
		]);

		appIcon.setToolTip('Clip Noted!');
		appIcon.setContextMenu(contextMenu);

		return this;
	};

	this.initWatch = function(path){
		this.watch = new Watch();

		this.watch.blacklist('^[.]', function(filename) {
			app.log('Blacklisted event to hidden file/dir: ' + filename);
		});

		this.watch.blacklist('^~', function(filename) {
			app.log('Blacklisted event to swap file: ' + filename);
		});

		this.watch.watch(path);

		app.log('Main Init: Watch');

		this.watch.addAction(function(data) {
			app.log('Main Trigged: noted.watch.action');
			// console.log(data.event + " : " + data.fullPath);
			mainWindow.webContents.send('noted.watch.data', data);
		});

		return this;
	};

	this.initStorage = function(config){
		var storage = config.root || path.join(__base, '../storage');

		// http://stackoverflow.com/a/24225816/4864081
		// if ( path.resolve(storage) === path.normalize(storage).replace(/[\/|\\]$/, '') ) {
		if ( path.isAbsolute(storage) ) {
			this.storage = path.resolve( storage );
		} else {
			this.storage = path.resolve(path.join(__base, '../', storage));
		}

		return this;
	};

	this.initWindow = function(){
		var size = this.screen.getPrimaryDisplay().workAreaSize;

		// https://github.com/atom/electron/blob/master/docs/api/browser-window.md
		mainWindow = new BrowserWindow({
			// icon : '/icon.png', // https://github.com/atom/electron/blob/master/docs/api/native-image.md
			// frame: false,
			width: 800, //size.width, //800,
			height: 600, //size.height, //600,
			// transparent:true,
			'subpixel-font-scaling': false,
			// 'auto-hide-menu-bar': true,
			'use-content-size': true,
			title: 'Noted!'
		});

		mainWindow.loadUrl('file://' + path.resolve(path.join(__base, 'root', 'index.html')));

		if( this.debug )
			mainWindow.toggleDevTools();
			// https://github.com/atom/electron/blob/master/docs/tutorial/devtools-extension.md
			// https://developer.chrome.com/extensions/devtools
			// https://developer.chrome.com/extensions/samples#search:devtools
			// https://github.com/facebook/react-devtools

		if ( this.config.maximize )
			mainWindow.maximize();

		mainWindow.focus();

		// Emitted when the window is closed.
		mainWindow.on('closed', function() {
			// Dereference the window object, usually you would store windows
			// in an array if your app supports multi windows, this is the time
			// when you should delete the corresponding element.
			mainWindow = null;
			appIcon = null;
		});

		mainWindow.webContents.on('did-finish-load', function() {
			mainWindow.webContents.send('noted.app.start', true);
		});

		return this;
	};

	this.destroy = function(){

		this.watch.cancelWatch(this.storage);

		this.winAbout = null;

		return null;
	};

	this.init = function(electron) {
		this.electron = electron;
		this.screen = require('screen');

		try {
			this.config = JSON.parse( fs.readFileSync( path.resolve( __base,'../config','config.json' ), 'utf-8' ) );
		} catch(e) {
			this.config = {};
			app.log('Main Error: Cannot parse config.json');
		}

		// https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md
		this.debug = this.config.debug || 'development' == process.env.NODE_ENV || false;

		app
			.initStorage(this.config)
			.log(this.storage)
			.initWatch(this.storage) // MUST: move to initDir
			.initWindow()
			.initMenu()
			.initTray()
			.initIPC();

		return this;
	};

	this.initIPC = function(){

		// https://github.com/atom/electron/blob/master/docs/api/ipc-renderer.md
		// https://github.com/atom/electron/blob/master/docs/api/ipc-main-process.md
		ipc.on('noted.app.booted', function(event, arg) {
			app.log('Main Catched: noted.app.booted');
			event.sender.send('noted.app.init', app.config);
		});

		ipc.on('noted.dir.init', function(event, arg) {

			//this.dir = app.dirTree( path.resolve(__dirname, '../', config.root||'storage' ) );
			var dir = app.dirTree( arg );
			//this.dir = app.dirTree( this.storage );

			//app.inspect( dir );
			app.log('Main Catched: noted.dir.init');

			event.sender.send('noted.dir.list', dir);
		});


		// ipc.on('synchronous-message', function(event, arg) {
		//   console.log(arg);  // prints "ping"
		//   event.returnValue = 'pong';
		// });

		return this;
	};

	this.initMenu = function(){

		var template = [
		  {
			label: 'Noted',
			submenu: [
			  {
				label: 'About Noted',
				selector: 'orderFrontStandardAboutPanel:'
			  },
			  {
				type: 'separator'
			  },
			  {
				label: 'Services',
				submenu: []
			  },
			  {
				type: 'separator'
			  },
			  {
				label: 'Hide Electron',
				accelerator: 'CmdOrCtrl+H',
				selector: 'hide:'
			  },
			  {
				label: 'Hide Others',
				accelerator: 'CmdOrCtrl+Shift+H',
				selector: 'hideOtherApplications:'
			  },
			  {
				label: 'Show All',
				selector: 'unhideAllApplications:'
			  },
			  {
				type: 'separator'
			  },
			  {
				label: 'Quit',
				accelerator: 'CmdOrCtrl+Q',
				click: function() {
					app.electron.quit();
				}
			  },
			]
		  },
		  {
			label: 'Edit',
			submenu: [
			  {
				label: 'Undo',
				accelerator: 'CmdOrCtrl+Z',
				selector: 'undo:'
			  },
			  {
				label: 'Redo',
				accelerator: 'Shift+CmdOrCtrl+Z',
				selector: 'redo:'
			  },
			  {
				type: 'separator'
			  },
			  {
				label: 'Cut',
				accelerator: 'CmdOrCtrl+X',
				selector: 'cut:'
			  },
			  {
				label: 'Copy',
				accelerator: 'CmdOrCtrl+C',
				selector: 'copy:'
			  },
			  {
				label: 'Paste',
				accelerator: 'CmdOrCtrl+V',
				selector: 'paste:'
			  },
			  {
				label: 'Select All',
				accelerator: 'CmdOrCtrl+A',
				selector: 'selectAll:'
			  },
			{
				type: 'separator'
			},
			{
				label: 'Direction RTL',
				accelerator: 'Alt+CmdOrCtrl+R',
				click: function() {
					BrowserWindow.getFocusedWindow().webContents.send('noted.app.rtl',true);
				}
			},
			{
				label: 'Direction LTR',
				accelerator: 'Alt+CmdOrCtrl+L',
				click: function() {
					// BrowserWindow.getFocusedWindow().webContents.executeJavaScript(
					// 	"noted.rtl(false);"
					// );
					BrowserWindow.getFocusedWindow().webContents.send('noted.app.rtl',false);
				}
			},

			]
		  },
		  {
			label: 'View',
			submenu: [
			  {
				label: 'Reload',
				accelerator: 'CmdOrCtrl+R',
				click: function() { BrowserWindow.getFocusedWindow().reloadIgnoringCache(); }
			  },
			  {
				label: 'Toggle DevTools',
				accelerator: 'Alt+CmdOrCtrl+I',
				click: function() { BrowserWindow.getFocusedWindow().toggleDevTools(); }
			  },
			]
		  },
		  {
			label: 'Window',
			submenu: [
			  {
				label: 'Minimize',
				accelerator: 'CmdOrCtrl+M',
				selector: 'performMiniaturize:'
			  },
			  {
				label: 'Close',
				accelerator: 'CmdOrCtrl+W',
				selector: 'performClose:'
			  },
			  {
				type: 'separator'
			  },
			  {
				label: 'Bring All to Front',
				selector: 'arrangeInFront:'
			  },
			]
		  },
		  {
			label: 'Help',
			submenu: [
				{
					label: 'About',
					click: function() {
						app.about();
					}
				},
			]
		  },
		];

		menu = Menu.buildFromTemplate(template);
		Menu.setApplicationMenu(menu);

		return this;
	};

	this.about = function(){
		this.winAbout = new BrowserWindow({
			width: 800,
			height: 600,
			transparent: true,
			frame: false
			});
			this.winAbout.setSkipTaskbar(true);
			this.winAbout.center();
			this.winAbout.loadUrl('http://noted.geminorum.ir/about');


		return this;
	};


	// http://dribbit.eu/nodejs/scan-a-directory
	this.scanTest1 = function(){
		// var dirPath = path.join(__dirname, 'files');
		// var dirPath = path.resolve( __dirname, '../..', this.config.root||'storage' );
		var dirPath = path.resolve( __dirname, '../', this.config.root||'storage');
		app.log(dirPath);
		fs.readdir(dirPath, function (err, files) {
			if (err) {
				app.log('Unable to scan dir ' + err);
				return this;
			}
			files.forEach(function (file) {
				// Do something with the file.
				app.log(file);
			});
		});

		return this;
	};

	this.scanTest2 = function(){
		var dirPath = path.resolve( __dirname, '../', this.config.root||'storage');
		app.log(dirPath);

		dir.paths(dirPath, function(err, paths) {
			if (err) throw err;
			console.log('files:\n',paths.files);
			console.log('subdirs:\n', paths.dirs);
		});
		return this;
	};

	// http://stackoverflow.com/a/15559850
	this.dirTree = function(base) {

		//# clean trailing '/'(s)
		var root = base.replace( /\/+$/ , "" );

		//# extract tree ring if root exists
		if ( fs.existsSync( root) ) {
			ring = fs.lstatSync( root );
		} else {
			app.log('error: root does not exist');
			return this;
		}

		// # type agnostic info
		// var stats = fs.lstatSync(root),
		var info = {
			path: root,
			id: 'tree-'+path.basename(root),
			label: path.basename(root)
		};

		if ( ring.isDirectory() ) {
			info.type = "dir";
			info.children = fs.readdirSync(root).map(function(child) {
				return app.dirTree(path.join(root, child));
			});
		}  else if ( ring.isFile() ) {
			info.type = 'file';
		} else if ( ring.isSymbolicLink() ){
			info.type = 'link';
		} else {
			info.type = 'unknown';
		}

		return info;
	};

	// FIXME: DRAFT
	// https://github.com/balaclark/node-mhtml
	this.mhtml = function() {

		mhtml.extract('path/to/file.mhtml', 'path/to/destination', function (err) {
			console.log('done.');
		});

		return this;
	};

	return this;
};

app.on('window-all-closed', function() {
	// if (app.listeners('window-all-closed').length == 1) {// Quit when all windows are closed and no other one is listening to this.
	if (process.platform != 'darwin') {// Quit when all windows are closed.
		noted
			.log('window-all-closed')
			.destroy();

		app.quit();
	}
});

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
	noted
		.init(this);
		// .scanTest2();
		// .inspect( noted.dirTree( path.resolve(__dirname, '../', 'storage' ) ) );

	// node dirTree.js ~/foo/bar
	// var util = require('util');
	// console.log(util.inspect(noted.dirTree(process.argv[2]), false, null));
});

var noted = new notedMain();

// http://krasimirtsonev.com/blog/article/Catch-uncaught-Exception-in-NodeJS-keep-node-running
process.on('uncaughtException', function(err) {
  console.log('Caught exception: ' + err);
});
