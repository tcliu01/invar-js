var Editor = {};
var Interpreter = {};
var Manage = {};
var Utility = {};
var Modules = {};

Utility.resize = function () {
    var main = document.getElementById("main");
    main.style.height = (window.innerHeight - 87) + "px";
}

Utility.load = function () {
    window.addEventListener("resize", Utility.resize);
    Utility.resize();
    var value = "";
    var keyMap = "default";
    if (localStorage.getItem("keyMap")) {
	keyMap = localStorage.getItem("keyMap");
	document.getElementById("opt-keymap").value = keyMap;
    }
    if (localStorage.getItem("debugLevel")) {
	document.getElementById("opt-debuglvl").value = localStorage.getItem("debugLevel");
	Interpreter.debugLevel = parseInt(localStorage.getItem("debugLevel"));
    }
    else {
	Interpreter.debugLevel = 0;	
    }
    if (localStorage.getItem("scriptOutput")) {
	document.getElementById("opt-scriptout").value = localStorage.getItem("scriptOutput");
	Interpreter.scriptOutput = localStorage.getItem("scriptOutput") == "yes";
    }
    else {
	Interpreter.scriptOutput = false;	
    }
    Editor.openDocuments = [];
    Editor.cm = CodeMirror(document.getElementById("program"), {
	keyMap: keyMap,
	lineNumbers: true
    });
    CodeMirror.commands.save = Editor.saveDocument;
    Editor.cm.on("change", Editor.tabChange);
    var snippetList = localStorage.getItem("snippetList");
    var directoryObject = localStorage.getItem("directoryObject");
    var fileObject = localStorage.getItem("fileObject");
    if (snippetList && directoryObject && fileObject) {
	Manage.snippetList = JSON.parse(snippetList);
	Manage.directoryObject = JSON.parse(directoryObject);
	Manage.fileObject = JSON.parse(fileObject);
    }
    else {
	Manage.snippetList = [];
	Manage.directoryObject = {"name": "", "isDirectory": true, "dirList": [], "fileList": []};
	Manage.fileObject = {};
	localStorage.setItem("snippetList", JSON.stringify(Manage.snippetList));
	localStorage.setItem("directoryObject", JSON.stringify(Manage.directoryObject));
	localStorage.setItem("fileObject", JSON.stringify(Manage.fileObject));
    }
    Manage.currentDirectory = Manage.directoryObject;
    Manage.currentPath = [Manage.currentDirectory];
    Manage.cancelMarked();
    var recentFiles = localStorage.getItem("recentFiles");
    if (recentFiles) {
	Manage.recentFiles = JSON.parse(recentFiles);
	if (Manage.recentFiles.length > 0) {
	    var mostRecent = Manage.recentFiles[Manage.recentFiles.length - 1];
	    if (mostRecent.path) {
		Editor.loadFile(mostRecent.name, mostRecent.path.fileName, mostRecent.path.filePath);
	    }
	    else {
		Editor.loadSnippet(mostRecent.name);
	    }
	}
	else {
	    Editor.newSnippet();
	}
    }
    else {
	Manage.recentFiles = [];
	localStorage.setItem("recentFiles", JSON.stringify(Manage.recentFiles));
	Editor.newSnippet();
    }
    var manageTabs = document.getElementsByClassName("overlay-tab-inactive");
    for (var i = 0; i < manageTabs.length; i++) {
	manageTabs[i].addEventListener("click", Manage.manageTabClick);
    }
    Manage.updateRecent();
    Manage.updateSnippets();
    Manage.updateDirectory();
    document.getElementById("output").value = "";
}

Utility.saveTextAsFile = function () {
    var textToWrite = Editor.cm.getValue();
    var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
    if (Editor.activeDocument.path) {
	var fileNameToSaveAs = Editor.activeDocument.path.fileName;
    }
    else {
	var fileNameToSaveAs = Editor.activeDocument.name + ".js";
    }

    var downloadLink = document.createElement("a");
    downloadLink.download = fileNameToSaveAs;
    downloadLink.innerHTML = "Download File";
    if (window.webkitURL != null)
    {
        // Chrome allows the link to be clicked
        // without actually adding it to the DOM.
        downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
    }
    else
    {
        // Firefox requires the link to be added to the DOM
        // before it can be clicked.
        downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
        downloadLink.addEventListener("click", Utility.downloadLinkClick);
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
    }
    
    downloadLink.click();
}

Utility.downloadLinkClick = function (event) {
    document.body.removeChild(event.target);
}

Utility.openOverlay = function (overlay) {
    document.getElementById(overlay).style.width = "100%";
}

Utility.closeOverlay = function (overlay) {
    document.getElementById(overlay).style.width = "0%";
}

Utility.keyMapChange = function () {
    var keymap = document.getElementById("opt-keymap");
    localStorage.setItem("keyMap", keymap.value);
}

Utility.scriptOutputChange = function () {
    var scriptout = document.getElementById("opt-scriptout");
    Interpreter.scriptOutput = scriptout.value == "yes";
    localStorage.setItem("scriptOutput", scriptout.value);
}

Utility.debugLevelChange = function () {
    var debuglvl = document.getElementById("opt-debuglvl");
    Interpreter.debugLevel = parseInt(debuglvl.value);
    localStorage.setItem("debugLevel", debuglvl.value);
}

Utility.hashCode = function (str) {
    var hash = 0;
    if (str.length == 0) return hash;
    for (var i = str.length-1; i >= 0; i--) {
	c = str.charCodeAt(i);
	hash = ((hash<<5)-hash)+c;
	if (hash < 0) hash *= -1;
    }
    return hash;
}

Utility.hashTime = function () {
    var d = new Date();
    d.getTime();
    var hash = Utility.hashCode(d.toString() + d.getMilliseconds());
    var base36 = "0123456789abcdefghijklmnopqrstuvwxyz";
    var ret = "";
    for (var i = 0; i < 6; i++) {
	ret += base36.charAt(hash % 36);
	hash /= 36;
    }
    return ret;
}

Interpreter.runProgram = function() {
    var str;
    var output = document.getElementById("output");
    output.value = "";
    d = new Date().getTime();
    try {
        with (Math) {
            str = Interpreter.formatOutput(eval(Editor.cm.getValue()));
        }
    } catch(e) {
        str = e.name+" at line "+(e.lineNumber)+": "+e.message;
    }
    if (str && Interpreter.scriptOutput) {
	writeln(str);
    }
}

Interpreter.formatOutput = function(a) {
    var str = "["
    if (typeof(a)=="object" && a.length) {
        for (var i=0; i < a.length; i++) 
            if (typeof(a[i])=="object" && a[i].length) {
                str += (i==0?"":" ")+"["
                for (var j=0; j<a[i].length; j++) 
                    str += a[i][j]+(j==a[i].length-1?
				    "]"+(i==a.length-1?"]":",")+"\n":", ");
            } else str += a[i]+(i==a.length-1?"]":", ");
    } else str = a;
    return str;
}

write = function(str) {
    var output = document.getElementById("output");
    output.value += Interpreter.formatOutput(str);
    output.scrollTop = output.scrollHeight;
}

writeln = function(str) {
    if (!str) str="";
    var output = document.getElementById("output");
    output.value += Interpreter.formatOutput(str)+"\n";
    output.scrollTop = output.scrollHeight;
}

get = function (url, params, query) {
    var Httpreq = new XMLHttpRequest();
    for (var i = 0; i < params.length; i++) {
	url += "/" + params[i];
    }
    url += "/?";
    for (var key in query) {
	url += key + "=" + query[key] + "&";
    }
    Httpreq.open("GET", url, false);
    Httpreq.send(null);
    return Httpreq.responseText;
}

sendByte = function (addr, value) {
    //write("Write byte addr=0x" + ("00" + addr.toString(16)).substr(-2) + " data=0x" + ("00" + value.toString(16)).substr(-2) + ": ");
    var sid = "0x" + ("00" + (addr>>1).toString(16)).substr(-2);
    var data = "0x" + ("00" + value.toString(16)).substr(-2);
    var params = ["wb", sid];
    var query = {"data": data};
    resp = JSON.parse(get("i2c", params, query));
    if (resp.result) {
        //writeln("Success");
        return true;
    } else {
        //writeln("Failed");
        return false;
    }
}

receiveByte = function (addr, num) {
    num = typeof num !== 'undefined' ? num : 1;
    //write("Read " + num + " byte(s) addr=0x" + ("00" + addr.toString(16)).substr(-2) + ": ");
    var data = Array.apply(null, Array(num)).map(Number.prototype.valueOf, -1);
    var sid = "0x" + ("00" + (addr>>1).toString(16)).substr(-2);
    var params = ["rb", sid];
    for (var i = 0; i < num; i++) {
	resp = JSON.parse(get("i2c", params, {}));
        if (resp.result) {
            //write("0x" + ("00" + resp.value.toString(16)).substr(-2) + " ");
        } else {
            //write("Failed");
            break;
        }
        data[i] = parseInt(resp.value);
    }
    //writeln("");
    if (num == 1) {
        return data[0];
    } else {
        return data;
    }
}

writeByte = function (addr, reg, value) {
    var sid = "0x" + ("00" + (addr>>1).toString(16)).substr(-2);
    var reg = "0x" + ("00" + reg.toString(16)).substr(-2);
    var data = "0x" + ("00" + value.toString(16)).substr(-2);
    var params = ["wd", sid];
    var query = {"reg": reg, "data": data};
    resp = JSON.parse(get("i2c", params, query));
    if (resp.result) {
        //writeln("Success");
        return true;
    } else {
        //writeln("Failed");
        return false;
    }    
}

readByte = function (addr, reg) {
    var sid = "0x" + ("00" + (addr>>1).toString(16)).substr(-2);
    var reg = "0x" + ("00" + reg.toString(16)).substr(-2);
    var params = ["rd", sid];
    var query = {"reg": reg};
    resp = JSON.parse(get("i2c", params, query));
    if (resp.result) {
        return parseInt(resp.value);
    }
    else {
	return -1;
    }
}

Editor.newSnippet = function () {
    var snippetName = "";
    do {
	snippetName = Utility.hashTime();
    } while (snippetName in Manage.fileObject);
    var snippet = {};
    snippet.name = snippetName;
    snippet.path = null;
    snippet.doc = Editor.cm.getDoc().copy(false)
    snippet.doc.setValue("// Snippet " + snippetName + "\n// Created " + Date() + "\n\n");
    snippet.changeGeneration = snippet.doc.changeGeneration();
    Editor.openDocuments[Editor.openDocuments.length] = snippet;
    Editor.addTab(snippet);
}

Editor.newFile = function (fileName, filePath) {
    var fileKey = "";
    do {
	fileKey = Utility.hashTime();
    } while (fileKey in Manage.fileObject);
    var file = {};
    file.name = fileKey;
    file.path = {"fileName": fileName, "filePath": filePath};
    file.doc = Editor.cm.getDoc().copy(false)
    file.doc.setValue("// File " + fileName + "\n// Created " + Date() + "\n\n// Enter your code here:\n");
    file.changeGeneration = file.doc.changeGeneration();
    Editor.openDocuments[Editor.openDocuments.length] = file;
    Editor.addTab(file);
    Editor.saveDocument();
    return fileKey;
}

Editor.loadSnippet = function (snippetName) {
    for (var i = 0; i < Editor.openDocuments.length; i++) {
	if (snippetName == Editor.openDocuments[i].name) {
	    Editor.swapTab("tab-" + snippetName);
	    return;
	}
    }
    if (snippetName in Manage.fileObject) {
	var snippet = {};
	snippet.name = snippetName;
	snippet.path = null;
	snippet.doc = Editor.cm.getDoc().copy(false)
	snippet.doc.setValue(Manage.fileObject[snippetName]);
	snippet.changeGeneration = snippet.doc.changeGeneration();
	Editor.openDocuments[Editor.openDocuments.length] = snippet;
	Editor.addTab(snippet);
	return;
    }
}

Editor.loadFile = function (fileName, dispName, filePath) {
    for (var i = 0; i < Editor.openDocuments.length; i++) {
	if (fileName == Editor.openDocuments[i].name) {
	    Editor.swapTab("tab-" + fileName);
	    return;
	}
    }
    if (fileName in Manage.fileObject) {
	var file = {};
	file.name = fileName;
	file.path = {"fileName": dispName, "filePath": filePath};
	file.doc = Editor.cm.getDoc().copy(false)
	file.doc.setValue(Manage.fileObject[fileName]);
	file.changeGeneration = file.doc.changeGeneration();
	Editor.openDocuments[Editor.openDocuments.length] = file;
	Editor.addTab(file);
	return;
    }
}

Editor.saveDocument = function () {
    if (!Editor.activeDocument.path && !(Editor.activeDocument.name in Manage.fileObject)) {
	Manage.snippetList[Manage.snippetList.length] = Editor.activeDocument.name;
	localStorage.setItem("snippetList", JSON.stringify(Manage.snippetList));
    }
    Manage.fileObject[Editor.activeDocument.name] = Editor.cm.getValue();
    localStorage.setItem("fileObject", JSON.stringify(Manage.fileObject));
    Editor.activeDocument.changeGeneration = Editor.activeDocument.doc.changeGeneration();
    Editor.tabChange();
    for (var i = 0; i < Manage.recentFiles.length; i++) {
	if (Manage.recentFiles[i].name == Editor.activeDocument.name) {
	    var myFile = Manage.recentFiles.splice(i, 1)[0];
	    Manage.recentFiles[Manage.recentFiles.length] = myFile;
	    localStorage.setItem("recentFiles", JSON.stringify(Manage.recentFiles));
	    break;
	}
    }
    if (i == Manage.recentFiles.length) {
	var myFile = {};
	myFile.name = Editor.activeDocument.name;
	myFile.path = Editor.activeDocument.path;
	Manage.recentFiles[Manage.recentFiles.length] = myFile;
	if (Manage.recentFiles.length > 10) {
	    Manage.recentFiles.splice(0, Manage.recentFiles.length - 10);
	}
	localStorage.setItem("recentFiles", JSON.stringify(Manage.recentFiles));
    }
    Manage.updateRecent();
    if (!Editor.activeDocument.path) {
	Manage.updateSnippets();
    }
}

Editor.addTab = function (doc) {
    var tabElement = document.getElementById("document-tabs");
    var tabTemplate = document.getElementById("document-tab-template");
    var newNode = document.importNode(tabTemplate.content, true);
    var span = newNode.querySelectorAll("span");
    span[0].id = "tab-" + doc.name;
    span[1].id = "changetab-" + doc.name;
    if (doc.path) {
	span[2].innerText = doc.path.fileName;
    }
    else {
	span[2].innerText = "Snippet: " + doc.name;
    }
    span[3].id = "closetab-" + doc.name;
    span[3].addEventListener("click", Editor.closeTab);
    tabElement.appendChild(newNode);
    Editor.swapTab("tab-" + doc.name);
}

Editor.swapTab = function (tabName) {
    var oldElement = document.getElementsByClassName("tab-active")[0];
    var newElement = document.getElementById(tabName);
    if (oldElement) {
	oldElement.classList.remove("tab-active");
	oldElement.classList.add("tab-inactive");
	oldElement.addEventListener("click", Editor.swapTabClick);
	var oldClose = document.getElementById("close" + oldElement.id);
	oldClose.style.display = "none";
    }
    newElement.classList.add("tab-active");
    newElement.classList.remove("tab-inactive");
    newElement.removeEventListener("click", Editor.swapTabClick);
    if (Editor.openDocuments.length > 1) {
	var newClose = document.getElementById("close" + newElement.id);
	newClose.style.display = "initial";
    }
    for (var i = 0; i < Editor.openDocuments.length; i++) {
	if (tabName.substring(4) == Editor.openDocuments[i].name) {
	    Editor.cm.swapDoc(Editor.openDocuments[i].doc);
	    Editor.activeDocument = Editor.openDocuments[i];    
	}
    }
}

Editor.swapTabClick = function () {
    Editor.swapTab(this.id);
}

Editor.closeTab = function () {
    if (Editor.openDocuments.length == 1) {
	return;
    }
    if (!Editor.activeDocument.doc.isClean(Editor.activeDocument.changeGeneration)) {
	if (!confirm("Unsaved changes, close anyway?")) {
	    return;
	}
    }
    var closedSnippet = Editor.activeDocument;
    for (var i = 0; i < Editor.openDocuments.length; i++) {
	if (closedSnippet == Editor.openDocuments[i]) {
	    if (i == Editor.openDocuments.length - 1) {
		var nextTab = Editor.openDocuments[i-1].name;
	    }
	    else {
		var nextTab = Editor.openDocuments[i+1].name;
	    }
	    var tabElement = document.getElementById("document-tabs");
	    var closedTab = document.getElementById("tab-" + closedSnippet.name);
	    tabElement.removeChild(closedTab);	    
	    Editor.openDocuments.splice(i, 1);
	    Editor.swapTab("tab-" + nextTab);
	}
    }
}

Editor.tabChange = function () {
    var activeTab = document.getElementsByClassName("tab-active")[0];
    var changeElement = document.getElementById("change" + activeTab.id);
    if (Editor.activeDocument.doc.isClean(Editor.activeDocument.changeGeneration)) {
	changeElement.style.display = "none";
    }
    else {
	changeElement.style.display = "initial";
    }
}

Manage.swapManageTab = function (sender) {
    var lastTab = document.getElementsByClassName("overlay-tab-active")[0];
    var lastTabpage = document.getElementById(lastTab.id + "page");
    lastTab.classList.remove("overlay-tab-active");
    lastTab.classList.add("overlay-tab-inactive");
    lastTab.addEventListener("click", Manage.manageTabClick);
    lastTabpage.classList.remove("overlay-tabpage-active");
    lastTabpage.classList.add("overlay-tabpage-inactive");
    var nextTab = document.getElementById(sender.id);
    var nextTabpage = document.getElementById(nextTab.id + "page");
    nextTab.classList.remove("overlay-tab-inactive");
    nextTab.classList.add("overlay-tab-active");
    nextTab.removeEventListener("click", Manage.manageTabClick);
    nextTabpage.classList.remove("overlay-tabpage-inactive");
    nextTabpage.classList.add("overlay-tabpage-active");
}

Manage.manageTabClick = function () {
    Manage.swapManageTab(this);
}

Manage.updateRecent = function () {
    var recentSidebar = document.getElementById("recent-sidebar");
    while (recentSidebar.firstChild) {
	recentSidebar.removeChild(recentSidebar.firstChild);
    }
    if (Manage.recentFiles.length == 0) {
	var childNode = document.createElement("div");
	childNode.classList.add("manager-text");
	childNode.innerText = "There are no recent files";
	recentSidebar.appendChild(childNode);
    }
    var itemTemplate = document.getElementById("manager-item-template");
    for (var i = Manage.recentFiles.length-1; i >= 0; i--) {
	var newNode = document.importNode(itemTemplate.content, true);
	var div = newNode.querySelectorAll("div");
	div[0].classList.add("manager-item-list");
	div[0].dataset.fileName = Manage.recentFiles[i].name;
	if (Manage.recentFiles[i].path) {
	    div[0].dataset.dispName = Manage.recentFiles[i].path.fileName;
	    div[0].dataset.filePath = Manage.recentFiles[i].path.filePath;
	}
	div[0].addEventListener("mouseover", Manage.loadRecentPreview);
	div[0].addEventListener("mouseout", Manage.clearRecentPreview);
	div[0].addEventListener("click", Manage.loadFileClick);
	if (Manage.recentFiles[i].path) {
	    div[3].innerText = Manage.recentFiles[i].path.fileName;
	    div[4].innerText = Manage.recentFiles[i].path.filePath;
	}
	else {
	    div[3].innerText = Manage.recentFiles[i].name;
	    div[4].innerText = "Snippet";
	}
	var itag = newNode.querySelectorAll("i");
	if (Manage.recentFiles[i].path) {
	    itag[0].innerText = "description";
	}
	else {
	    itag[0].innerText = "code";
	}
	recentSidebar.appendChild(newNode);
    }    
}

Manage.updateSnippets = function () {
    var snippetSidebar = document.getElementById("snippet-sidebar");
    while (snippetSidebar.firstChild) {
	snippetSidebar.removeChild(snippetSidebar.firstChild);
    }
    if (Manage.snippetList.length == 0) {
	var childNode = document.createElement("div");
	childNode.classList.add("manager-text");
	childNode.innerText = "There are no snippets";
	snippetSidebar.appendChild(childNode);
    }
    var itemTemplate = document.getElementById("manager-item-template");
    for (var i = 0; i < Manage.snippetList.length; i++) {
	var newNode = document.importNode(itemTemplate.content, true);
	var div = newNode.querySelectorAll("div");
	div[0].classList.add("manager-item-list");
	div[0].dataset.fileName = Manage.snippetList[i];
	div[0].addEventListener("mouseover", Manage.loadSnippetPreview);
	div[0].addEventListener("mouseout", Manage.clearSnippetPreview);
	div[0].addEventListener("click", Manage.loadFileClick);
	div[3].innerText = Manage.snippetList[i];
	div[4].innerText = "Snippet";
	div[5].addEventListener("click", Manage.deleteSnippetClick);
	div[5].addEventListener("mouseover", Manage.disableLoadOver);
	div[5].addEventListener("mouseout", Manage.disableLoadOut);
	var itag = newNode.querySelectorAll("i");
	itag[0].innerText = "code";
	itag[1].innerText = "delete";
	snippetSidebar.appendChild(newNode);
    }    
}

Manage.updateDirectory = function () {
    var dirFilepath = document.getElementById("directory-filepath");
    var dirFilebox = document.getElementById("directory-filebox");
    while (dirFilepath.firstChild) {
	dirFilepath.removeChild(dirFilepath.firstChild);
    }
    while (dirFilebox.firstChild) {
	dirFilebox.removeChild(dirFilebox.firstChild);
    }
    Manage.updateToolbar();
    for (var i = 0; i < Manage.currentPath.length; i++) {
	var childNode = document.createElement("span");
	if (Manage.currentPath[i].name) {
	    childNode.innerText = Manage.currentPath[i].name;
	} else {
	    childNode.innerText = "Root";
	}
	childNode.classList.add("filepath-item");
	childNode.dataset.dirIndex = Manage.currentPath.length - (i + 1);
	childNode.addEventListener("click", Manage.navigateUpClick);
	dirFilepath.appendChild(childNode);
	if (i < (Manage.currentPath.length - 1)) {
	    childNode = document.createElement("span");
	    childNode.innerText = "\u2002\u25B6\u2002";
	    dirFilepath.appendChild(childNode);
	}
    }
    var itemTemplate = document.getElementById("manager-item-template");
    for (i = 0; i < Manage.currentDirectory.dirList.length; i++) {
	var dirObj = Manage.currentDirectory.dirList[i];
	var newNode = document.importNode(itemTemplate.content, true);
	var div = newNode.querySelectorAll("div");
	var itag = newNode.querySelectorAll("i");
	div[0].classList.add("manager-item-grid");
	div[0].dataset.dirName = dirObj.name;
	div[0].addEventListener("click", Manage.navigateDownClick);
	div[3].innerText = dirObj.name;
	div[4].innerText = "Directory";
	div[5].addEventListener("click", Manage.flagItemClick);
	div[5].addEventListener("mouseover", Manage.disableNavigateOver);
	div[5].addEventListener("mouseout", Manage.disableNavigateOut);
	itag[0].innerText = "folder";
	itag[1].innerText = "flag";
	dirFilebox.appendChild(newNode);
    }
    var pathString = Manage.currentPathToString(true);
    for (i = 0; i < Manage.currentDirectory.fileList.length; i++) {
	var fileObj = Manage.currentDirectory.fileList[i];
	var newNode = document.importNode(itemTemplate.content, true);
	var div = newNode.querySelectorAll("div");
	var itag = newNode.querySelectorAll("i");
	div[0].classList.add("manager-item-grid");
	div[0].dataset.fileName = fileObj.fileKey;
	div[0].dataset.dispName = fileObj.name;
	div[0].dataset.filePath = pathString;
	div[0].addEventListener("click", Manage.loadFileClick);
	div[3].innerText = fileObj.name;
	div[4].innerText = "File";
	div[5].addEventListener("click", Manage.flagItemClick);
	div[5].addEventListener("mouseover", Manage.disableLoadOver);
	div[5].addEventListener("mouseout", Manage.disableLoadOut);
	itag[0].innerText = "description";
	itag[1].innerText = "flag";
	dirFilebox.appendChild(newNode);
    }
}

Manage.flagItem = function (sender) {
    sender.parentNode.classList.toggle("manager-item-marked");
    Manage.updateToolbar();
}

Manage.flagItemClick = function () {
    Manage.flagItem(this);
}

Manage.updateToolbar = function () {
    var buttons = document.getElementsByClassName("overlay-tab-button");
    for (var i = 0; i < buttons.length; i++) {
	buttons[i].style.display = "none";
    }
    var numSelected = document.getElementsByClassName("manager-item-marked").length;
    if (Manage.copyMode || Manage.moveMode) {
	document.getElementById("manage-button-paste").style.display = "inline-block";
	document.getElementById("manage-button-cancel").style.display = "inline-block";
    } else {
	if (numSelected == 0) {
	    document.getElementById("manage-button-newfile").style.display = "inline-block";
	    document.getElementById("manage-button-newfolder").style.display = "inline-block";	
	}
	else {
	    if (numSelected == 1) {
		document.getElementById("manage-button-rename").style.display = "inline-block";
	    }
	    document.getElementById("manage-button-copy").style.display = "inline-block";
	    document.getElementById("manage-button-cut").style.display = "inline-block";
	    document.getElementById("manage-button-delete").style.display = "inline-block";
	}
    }
}

Manage.loadPreview = function (sender, target) {
    if (sender.dataset.fileName in Manage.fileObject) {
	document.getElementById(target).innerText = Manage.fileObject[sender.dataset.fileName];
    }
}

Manage.clearPreview = function (sender, target) {
    document.getElementById(target).innerText = "";
}

Manage.loadRecentPreview = function () {
    Manage.loadPreview(this, "recent-preview");
}

Manage.clearRecentPreview = function () {
    Manage.clearPreview(this, "recent-preview");
}

Manage.loadSnippetPreview = function () {
    Manage.loadPreview(this, "snippet-preview");
}

Manage.clearSnippetPreview = function () {
    Manage.clearPreview(this, "snippet-preview");
}

Manage.loadFile = function (sender) {
    if (sender.dataset.filePath && sender.dataset.dispName) {
	Editor.loadFile(sender.dataset.fileName, sender.dataset.dispName, sender.dataset.filePath);
    }
    else {
	Editor.loadSnippet(sender.dataset.fileName);
    }
    Utility.closeOverlay("overlay-manage");
}

Manage.loadFileClick = function () {
    Manage.loadFile(this);
}

Manage.enableLoadFile = function (sender) {
    sender.parentNode.addEventListener("click", Manage.loadFileClick);
}

Manage.disableLoadFile = function (sender) {
    sender.parentNode.removeEventListener("click", Manage.loadFileClick);
}

Manage.disableLoadOver = function () {
    Manage.disableLoadFile(this);
}

Manage.disableLoadOut = function () {
    Manage.enableLoadFile(this);
}

Manage.enableNavigateDown = function (sender) {
    sender.parentNode.addEventListener("click", Manage.navigateDownClick);
}

Manage.disableNavigateDown = function (sender) {
    sender.parentNode.removeEventListener("click", Manage.navigateDownClick);
}

Manage.disableNavigateOver = function () {
    Manage.disableNavigateDown(this);
}

Manage.disableNavigateOut = function () {
    Manage.enableNavigateDown(this);
}

Manage.deleteSnippet = function (sender) {
    var fileName = sender.parentNode.dataset.fileName;
    if (confirm("Are you sure you want to delete " + fileName + "?\nIt will be gone forever! (a really long time)")) {
	for (var i = 0; i < Manage.snippetList.length; i++) {
	    if (Manage.snippetList[i] == fileName) {
		Manage.snippetList.splice(i, 1);
		delete Manage.fileObject[fileName];
		localStorage.setItem("snippetList", JSON.stringify(Manage.snippetList));
		localStorage.setItem("fileObject", JSON.stringify(Manage.fileObject));
		for (var j = 0; j < Manage.recentFiles.length; j++) {
		    if (Manage.recentFiles[j].name == fileName) {
			Manage.recentFiles.splice(j, 1);
			localStorage.setItem("recentFiles", JSON.stringify(Manage.recentFiles));
		    }
		}
		Manage.updateRecent();
		Manage.updateSnippets();
		return;
	    }
	}
    }
}

Manage.deleteSnippetClick = function () {
    Manage.deleteSnippet(this);
}

Manage.currentPathToString = function (rootFix) {
    if (Manage.currentPath.length == 1 && rootFix) {
	return "/";
    }
    var str = "";
    for (var i = 1; i < Manage.currentPath.length; i++) {
	str += "/";
	str += Manage.currentPath[i].name;
    }
    return str;
}

Manage.newFile = function () {
    Utility.openOverlay("overlay-manage");
    Manage.swapManageTab(document.getElementById("files-tab"));
    var fileName = prompt("Enter a name for the new file:");
    if (fileName) {
	fileName = fileName.replace(/\//g, "_");
	if (!fileName.toLowerCase().endsWith(".js")) {
	    fileName = fileName + ".js";
	}
	var insertIndex = Manage.currentDirectory.fileList.length;
	for (var i = 0; i < Manage.currentDirectory.fileList.length; i++) {
	    var fileObj = Manage.currentDirectory.fileList[i];
	    if (fileName <= fileObj.name) {
		insertIndex = i;
		break;
	    }
	}
	if (Manage.currentDirectory.fileList.length > 0) {
	    if (fileName == fileObj.name) {
		return;
	    }
	}
	var newFileKey = Editor.newFile(fileName, Manage.currentPathToString(true));
	var newFile = {"name": fileName, "isDirectory": false, "fileKey": newFileKey};
	Manage.currentDirectory.fileList.splice(insertIndex, 0, newFile);
	localStorage.setItem("directoryObject", JSON.stringify(Manage.directoryObject));
	Manage.updateDirectory();
	Utility.closeOverlay("overlay-manage");
    }
}

Manage.newFolder = function () {
    var dirName = prompt("Enter a name for the new folder:");
    if (dirName) {
	dirName = dirName.replace(/\//g, "_");
	var insertIndex = Manage.currentDirectory.dirList.length;
	for (var i = 0; i < Manage.currentDirectory.dirList.length; i++) {
	    var dirObj = Manage.currentDirectory.dirList[i];
	    if (dirName <= dirObj.name) {
		insertIndex = i;
		break;
	    }
	}
	if (Manage.currentDirectory.dirList.length > 0) {
	    if (dirName == dirObj.name) {
		return;
	    }
	}
	var newDir = {"name": dirName, "isDirectory": true, "dirList": [], "fileList": []};
	Manage.currentDirectory.dirList.splice(insertIndex, 0, newDir);
	localStorage.setItem("directoryObject", JSON.stringify(Manage.directoryObject));
	Manage.updateDirectory();
    }
}

Manage.navigateUp = function (sender) {
    var dirIndex = parseInt(sender.dataset.dirIndex);
    Manage.currentPath.splice(dirIndex*-1, dirIndex);
    Manage.currentDirectory = Manage.currentPath[Manage.currentPath.length-1];
    Manage.updateDirectory();
}

Manage.navigateUpClick = function () {
    Manage.navigateUp(this);
}

Manage.navigateDown = function (sender) {
    var dirName = sender.dataset.dirName;
    for (var i = 0; i < Manage.currentDirectory.dirList.length; i++) {
	if (Manage.currentDirectory.dirList[i].name == dirName) {
	    Manage.currentDirectory = Manage.currentDirectory.dirList[i];
	    Manage.currentPath[Manage.currentPath.length] = Manage.currentDirectory;
	    Manage.updateDirectory();
	}	
    }
}

Manage.navigateDownClick = function () {
    Manage.navigateDown(this);
}

Manage.renameFile = function () {
    var file = document.getElementsByClassName("manager-item-marked")[0];
    if (file.dataset.dirName) {
	var newName = prompt("Enter a new name for the folder:");
	if (newName) {
	    newName = newName.replace(/\//g, "_");
	    for (var i = 0; i < Manage.currentDirectory.dirList.length; i++) {
		var dir = Manage.currentDirectory.dirList[i];
		if (dir.name == newName) {
		    Manage.updateDirectory();
		    return;
		}
		else if (dir.name == file.dataset.dirName) {
		    var oldIndex = i;
		}
	    }
	    var dirObj = Manage.currentDirectory.dirList.splice(oldIndex, 1)[0];
	    dirObj.name = newName;
	    var insertIndex = Manage.currentDirectory.dirList.length;
	    for (var i = 0; i < Manage.currentDirectory.dirList.length; i++) {
		var tmpDir = Manage.currentDirectory.dirList[i];
		if (newName <= tmpDir.name) {
		    insertIndex = i;
		    break;
		}
	    }
	    Manage.currentDirectory.dirList.splice(insertIndex, 0, dirObj);
	    var oldPath = Manage.currentPathToString(false) + "/" + file.dataset.dirName;
	    var newPath = Manage.currentPathToString(false) + "/" + newName;
	    for (i = 0; i < Editor.openDocuments.length; i++) {
		if (Editor.openDocuments[i].path) {
		    if (Editor.openDocuments[i].path.filePath.startsWith(oldPath)) {
			Editor.openDocuments[i].path.filePath = newPath + Editor.openDocuments[i].path.filePath.slice(oldPath.length);
		    }
		}
	    }
	    for (i = 0; i < Manage.recentFiles.length; i++) {
		if (Manage.recentFiles[i].path) {
		    if (Manage.recentFiles[i].path.filePath.startsWith(oldPath)) {
			Manage.recentFiles[i].path.filePath = newPath + Manage.recentFiles[i].path.filePath.slice(oldPath.length);
		    }
		}
	    }
	}
    } else {
	var newName = prompt("Enter a new name for the file:");
	if (newName) {
	    newName = newName.replace(/\//g, "_");
	    if (!newName.toLowerCase().endsWith(".js")) {
		newName = newName + ".js";
	    }
	    for (var i = 0; i < Manage.currentDirectory.fileList.length; i++) {
		var f = Manage.currentDirectory.fileList[i];
		if (f.name == newName) {
		    Manage.updateDirectory();
		    return;
		}
		else if (f.name == file.dataset.dispName) {
		    var oldIndex = i;
		}
	    }
	    var fileObj = Manage.currentDirectory.fileList.splice(oldIndex, 1)[0];
	    fileObj.name = newName;
	    var insertIndex = Manage.currentDirectory.fileList.length;
	    for (var i = 0; i < Manage.currentDirectory.fileList.length; i++) {
		var tmpFile = Manage.currentDirectory.fileList[i];
		if (newName <= tmpFile.name) {
		    insertIndex = i;
		    break;
		}
	    }
	    Manage.currentDirectory.fileList.splice(insertIndex, 0, fileObj);
	    for (i = 0; i < Editor.openDocuments.length; i++) {
		if (Editor.openDocuments[i].name == fileObj.fileKey) {
		    Editor.openDocuments[i].path.fileName = newName;
		    var tab = document.getElementById("tab-" + fileObj.fileKey);
		    tab.querySelectorAll("span")[1].innerText = newName;
		}
	    }
	    for (i = 0; i < Manage.recentFiles.length; i++) {
		if (Manage.recentFiles[i].name == fileObj.fileKey) {
		    Manage.recentFiles[i].path.fileName = newName;
		}
	    }
	}
    }
    Manage.updateDirectory();
    Manage.updateRecent();
    localStorage.setItem("directoryObject", JSON.stringify(Manage.directoryObject));
    localStorage.setItem("recentFiles", JSON.stringify(Manage.recentFiles));
}

Manage.registerMarked = function (copyMode, moveMode) {
    Manage.markedSet = [];
    Manage.sourceDirectory = Manage.currentDirectory;
    Manage.sourcePath = Manage.currentPathToString(false);
    var marked = document.getElementsByClassName("manager-item-marked");
    for (var i = 0; i < marked.length; i++) {
	if (marked[i].dataset.dirName) {
	    for (var j = 0; j < Manage.currentDirectory.dirList.length; j++) {
		var dirObj = Manage.currentDirectory.dirList[j];
		if (marked[i].dataset.dirName == dirObj.name) {
		    Manage.markedSet[Manage.markedSet.length] = dirObj;
		    break;
		}
	    }
	}
	else {
	    for (var j = 0; j < Manage.currentDirectory.fileList.length; j++) {
		var fileObj = Manage.currentDirectory.fileList[j];
		if (marked[i].dataset.dispName == fileObj.name) {
		    Manage.markedSet[Manage.markedSet.length] = fileObj;
		    break;
		}
	    }
	}
    }
    Manage.copyMode = copyMode;
    Manage.moveMode = moveMode;
    Manage.updateToolbar();
}

Manage.copyClick = function () {
    Manage.registerMarked(true, false);
}

Manage.cutClick = function () {
    Manage.registerMarked(false, true);
}

Manage.cancelMarked = function () {
    Manage.markedSet = [];
    Manage.sourceDirectory = null;
    Manage.sourcePath = "";
    Manage.copyMode = false;
    Manage.moveMode = false;
    Manage.updateToolbar();
}

Manage.pasteClick = function () {
    if (Manage.copyMode) {
	Manage.copyMarked();
    }
    else if (Manage.moveMode) {
	Manage.moveMarked();
    }
}

Manage.moveMarked = function () {
    var destDirectory = Manage.currentDirectory;
    for (var i = 0; i < Manage.markedSet.length; i++) {
	if (Manage.markedSet[i].isDirectory) {
	    var oldPath = Manage.sourcePath + "/" + Manage.markedSet[i].name;
	    var oldName = Manage.markedSet[i].name;
	    if (Manage.currentPathToString(true).startsWith(oldPath)) {
		continue;
	    }
	    var index = Manage.sourceDirectory.dirList.indexOf(Manage.markedSet[i]);
	    var dupeCount = 2;
	    Manage.sourceDirectory.dirList.splice(index, 1);
	    while (true) {
		var insertIndex = Manage.currentDirectory.dirList.length;
		for (var j = 0; j < Manage.currentDirectory.dirList.length; j++) {
		    var dirObj = Manage.currentDirectory.dirList[j];
		    if (Manage.markedSet[i].name <= dirObj.name) {
			insertIndex = j;
			break;
		    }
		}
		if (Manage.currentDirectory.dirList.length > 0) {
		    if (Manage.markedSet[i].name == dirObj.name) {
			Manage.markedSet[i].name = oldName + " (" + dupeCount++ + ")";
			continue;
		    }
		}
		break;
	    }
	    Manage.currentDirectory.dirList.splice(insertIndex, 0, Manage.markedSet[i]);
	    var newPath = Manage.currentPathToString(false) + "/" + Manage.markedSet[i].name;
	    for (j = 0; j < Editor.openDocuments.length; j++) {
		if (Editor.openDocuments[j].path) {
		    if (Editor.openDocuments[j].path.filePath.startsWith(oldPath)) {
			Editor.openDocuments[j].path.filePath = newPath + Editor.openDocuments[j].path.filePath.slice(oldPath.length);
		    }
		}
	    }
	    for (j = 0; j < Manage.recentFiles.length; j++) {
		if (Manage.recentFiles[j].path) {
		    if (Manage.recentFiles[j].path.filePath.startsWith(oldPath)) {
			Manage.recentFiles[j].path.filePath = newPath + Manage.recentFiles[j].path.filePath.slice(oldPath.length);
		    }
		}
	    }
	}
	else {
	    var oldName = Manage.markedSet[i].name;
	    var index = Manage.sourceDirectory.fileList.indexOf(Manage.markedSet[i]);
	    var dupeCount = 2;
	    Manage.sourceDirectory.fileList.splice(index, 1);
	    while (true) {
		var insertIndex = Manage.currentDirectory.fileList.length;
		for (var j = 0; j < Manage.currentDirectory.fileList.length; j++) {
		    var fileObj = Manage.currentDirectory.fileList[j];
		    if (Manage.markedSet[i].name <= fileObj.name) {
			insertIndex = j;
			break;
		    }
		}
		if (Manage.currentDirectory.fileList.length > 0) {
		    if (Manage.markedSet[i].name == fileObj.name) {
			Manage.markedSet[i].name = oldName.slice(0, oldName.lastIndexOf(".")) + " (" + dupeCount++ + ")" + oldName.slice(oldName.lastIndexOf("."));
			continue;
		    }
		}
		break;
	    }
	    Manage.currentDirectory.fileList.splice(insertIndex, 0, Manage.markedSet[i]);
	    var newPath = Manage.currentPathToString(true);
	    for (j = 0; j < Editor.openDocuments.length; j++) {
		if (Editor.openDocuments[j].name == Manage.markedSet[i].fileKey) {
		    Editor.openDocuments[j].path.filePath = newPath;
		    Editor.openDocuments[j].path.fileName = Manage.markedSet[i].name;
		    var tab = document.getElementById("tab-" + Manage.markedSet[i].fileKey);
		    tab.querySelectorAll("span")[1].innerText =  Manage.markedSet[i].name;
		}
	    }
	    for (j = 0; j < Manage.recentFiles.length; j++) {
		if (Manage.recentFiles[j].name == Manage.markedSet[i].fileKey) {
		    Manage.recentFiles[j].path.filePath = newPath;
		    Manage.recentFiles[j].path.fileName = Manage.markedSet[i].name;
		}
	    }
	}
    }
    localStorage.setItem("directoryObject", JSON.stringify(Manage.directoryObject));
    localStorage.setItem("recentFiles", JSON.stringify(Manage.recentFiles));
    Manage.cancelMarked();
    Manage.updateDirectory();
    Manage.updateRecent();
}

Manage.copyMarked = function () {
    var destDirectory = Manage.currentDirectory;
    for (var i = 0; i < Manage.markedSet.length; i++) {
	if (Manage.markedSet[i].isDirectory) {
	    Manage.copyDirectory(Manage.markedSet[i], destDirectory);
	}
	else {
	    Manage.copyFile(Manage.markedSet[i], destDirectory);
	}
    }
    localStorage.setItem("directoryObject", JSON.stringify(Manage.directoryObject));
    localStorage.setItem("fileObject", JSON.stringify(Manage.fileObject));
    Manage.cancelMarked();
    Manage.updateDirectory();    
}

Manage.copyDirectory = function (dir, destDir) {
    var newDir = {"name": dir.name, "isDirectory": true, "dirList": [], "fileList": []};
    for (var i = 0; i < dir.dirList.length; i++) {
	Manage.copyDirectory(dir.dirList[i], newDir);
    }
    for (var i = 0; i < dir.fileList.length; i++) {
	Manage.copyFile(dir.fileList[i], newDir);
    }
    var dupeCount = 2;
    while (true) {
	var insertIndex = destDir.dirList.length;
	for (var i = 0; i < destDir.dirList.length; i++) {
	    var tmpDir = destDir.dirList[i];
	    if (newDir.name <= tmpDir.name) {
		insertIndex = i;
		break;
	    }
	}
	if (destDir.dirList.length > 0) {
	    if (newDir.name == tmpDir.name) {
		newDir.name = dir.name + " (" + dupeCount++ + ")";
		continue;
	    }
	}
	break;
    }
    destDir.dirList.splice(insertIndex, 0, newDir);  
}

Manage.copyFile = function (file, destDir) {
    var fileKey = "";
    do {
	fileKey = Utility.hashTime();
    } while (fileKey in Manage.fileObject);
    var newFile = {"name": file.name, "isDirectory": false, "fileKey": fileKey};
    Manage.fileObject[fileKey] = Manage.fileObject[file.fileKey];
    var dupeCount = 2;
    while (true) {
	var insertIndex = destDir.fileList.length;
	for (var i = 0; i < destDir.fileList.length; i++) {
	    var tmpFile = destDir.fileList[i];
	    if (newFile.name <= tmpFile.name) {
		insertIndex = i;
		break;
	    }
	}
	if (destDir.fileList.length > 0) {
	    if (newFile.name == tmpFile.name) {
		newFile.name = file.name.slice(0, file.name.lastIndexOf(".")) + " (" + dupeCount++ + ")" + file.name.slice(file.name.lastIndexOf("."));
		continue;
	    }
	}
	break;
    }
    destDir.fileList.splice(insertIndex, 0, newFile);  
}

Manage.deleteMarked = function () {
    var marked = document.getElementsByClassName("manager-item-marked");
    if (marked.length > 1) {
	var itemCount = "these " + marked.length + " items";
    }
    else {
	if (marked[0].dataset.dirName) {
	    var itemCount = marked[0].dataset.dirName + " and its contents";
	}
	else {
	    var itemCount = marked[0].dataset.dispName;
	}
    }
    if (confirm("Are you sure you want to delete " + itemCount + "?")) {
	Manage.registerMarked(false, false);
	for (var i = 0; i < Manage.markedSet.length; i++) {
	    if (Manage.markedSet[i].isDirectory) {
		Manage.deleteDirectory(Manage.markedSet[i], Manage.currentDirectory);
	    }
	    else {
		Manage.deleteFile(Manage.markedSet[i], Manage.currentDirectory);
	    }
	}
	localStorage.setItem("directoryObject", JSON.stringify(Manage.directoryObject));
	localStorage.setItem("fileObject", JSON.stringify(Manage.fileObject));
	localStorage.setItem("recentFiles", JSON.stringify(Manage.recentFiles));
	Manage.cancelMarked();
	Manage.updateDirectory();    
	Manage.updateRecent();
    }
}

Manage.deleteDirectory = function (dir, parentDir) {
    while (dir.dirList[0]) {
	Manage.deleteDirectory(dir.dirList[0], dir);
    }
    while (dir.fileList[0]) {
	Manage.deleteFile(dir.fileList[0], dir);
    }
    parentDir.dirList.splice(parentDir.dirList.indexOf(dir), 1);
}

Manage.deleteFile = function (file, dir) {
    dir.fileList.splice(dir.fileList.indexOf(file), 1);
    delete Manage.fileObject[file.fileKey];
    for (var i = 0; i < Editor.openDocuments.length; i++) {
	if (Editor.openDocuments[i].name == file.fileKey) {
	    var tabElement = document.getElementById("document-tabs");
	    var closedTab = document.getElementById("tab-" + file.fileKey);
	    if (closedTab.classList.contains("tab-active")) {
		if (Editor.openDocuments.length == 1) {
		    Editor.newSnippet();
		    var nextTab = Editor.openDocuments[1].name;
		}
		else if (i == Editor.openDocuments.length - 1) {
		    var nextTab = Editor.openDocuments[i-1].name;
		}
		else {
		    var nextTab = Editor.openDocuments[i+1].name;
		}
	    }
	    tabElement.removeChild(closedTab);
	    Editor.openDocuments.splice(i, 1);
	    if (nextTab) {
		Editor.swapTab("tab-" + nextTab);
	    }
	    break;
	}
    }
    for (i = 0; i < Manage.recentFiles.length; i++) {
	if (Manage.recentFiles[i].name == file.fileKey) {
	    Manage.recentFiles.splice(i, 1);
	}
    }
}
