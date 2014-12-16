var fs = require('fs')
  , path = require('path')
  , assert = require('assert')
  , minimatch = require('minimatch')
  , rimraf = require('rimraf')

var views = fs.readdirSync('.')
views.forEach(function(view) {
  if (path.extname(view) == '.json') {
    var viewMap = readViewMap(view) || {}
      , folders = viewMap.folders || []
      , pathRoot = viewMap.pathPrefix || '.'
      , basedir = path.basename(view, '.json');
    if (fs.existsSync(basedir)) rimraf.sync(basedir)
    fs.mkdirSync(basedir)
    folders = folders.map(validateFolder)
    folders.forEach(createLinks(basedir, pathRoot))
  }
});



function readViewMap(view) {
  var map = JSON.parse(fs.readFileSync(view));
  return map;
}

function validateFolder(folder) {
  assert(folder.path, "Folder objects must specify a path");
  folder.name = folder.name || folder.path;
  return folder;
}

function createLinks(basedir, pathRoot) {
  return function (folder) {
    var pathFolder = path.join(pathRoot, folder.path)
      , oldDir = process.cwd()
      , cwd = path.resolve(basedir)
      , srcPath = path.resolve(pathFolder)

    if (isOneToOne(folder)) {
      process.chdir(cwd)
      fs.symlinkSync(srcPath, folder.name, 'dir')
      process.chdir(oldDir)
    }
    else {
      var namedFolder = path.resolve(path.join(basedir, folder.name))
      fs.mkdirSync(namedFolder)
      var includes = folder.folder_include_patterns || ['*']
        , excludes = folder.folder_exclude_patterns || []
        , absolutePath = path.resolve(path.join(pathRoot, folder.path))
        , matches = getFolderMatches(absolutePath, includes, excludes)
      matches.forEach(function(match) {
        var base = path.basename(match)
          , src  = path.join(absolutePath, base)
        process.chdir(namedFolder)
        fs.symlinkSync(src, base, 'dir')
        process.chdir(oldDir)
      })
    }
  }
}

function isOneToOne(folder) {
  return !(folder.folder_include_patterns || folder.folder_exclude_patterns);
}

function getFolderMatches(folder, includes, excludes) {
  var entries = fs.readdirSync(folder);
  var matches = [];
  entries.forEach(function(entry) {
    var entry = path.join(folder, entry)
    if (fs.statSync(entry).isDirectory()) {
      for (var i = 0; i < includes.length; ++i) {
        var pattern = includes[i];
        if (minimatch(entry, pattern, { matchBase: true })) {
          matches.push(path.join(folder, entry));
          break;
        }
      }
    }
  })

  var valid = [];
  matches.forEach(function(match) {
    valid.push(match);
    for (var i = 0; i < excludes.length; ++i) {
      var pattern = excludes[i];
      if (minimatch(match, pattern, { matchBase: true })) {
        valid.pop();
        break;
      }
    }
  })

  return valid;
}
