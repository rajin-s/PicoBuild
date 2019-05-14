const remote = require('electron').remote
const fs = require('fs')

function closeWindow() {
    remote.getCurrentWindow().close()
}

function foreach(arr, f) {
    for (i = 0; i < arr.length; i++) {
        f(arr[i])
    }
}

var project = {
    open: false,
    unsavedChanges: false,
    editing: "",
    folder: "",
    path: "",
    name: "",
    text: "",
    header: "pico-8 cartridge // http://www.pico-8.com\nversion 16\n",

    scriptSources: [],
    spriteSources: [],
    mapSources: [],
    sfxSources: [],
    musicSources: [],

    generateText: () => {
        text = ""
        text += project.header

        text += "__lua__\n"
        foreach(project.scriptSources, (source) => {
            if (source.endsWith(".p8")) {
                text += `#import lua from ${source}\n`
            }
            else {
                text += `#include lua ${source}\n`
            }
        })

        text += "\n__gfx__\n"
        foreach(project.spriteSources, (source) => {
            if (source.endsWith(".p8")) {
                text += `#import gfx from ${source}\n`
            }
            else {
                text += `#include png ${source}\n`
            }
        })

        text += "\n__map__\n"
        foreach(project.mapSources, (source) => {
            if (source.endsWith(".p8")) {
                text += `#import map from ${source}\n`
            }
            else if (source.endsWith(".p8map")) {
                text += `#import map raw from ${source}\n`
            }
            else {
                text += `#include tmx ${source}\n`
            }
        })
        
        text += "\n__sfx__\n"
        foreach(project.sfxSources, (source) => {
            if (source.endsWith(".p8")) {
                text += `#import sfx from ${source}\n`
            }
            else if (source.endsWith(".p8sfx")) {
                text += `#import sfx raw from ${source}\n`
            }
        })
        
        text += "\n__music__\n"
        foreach(project.musicSources, (source) => {
            if (source.endsWith(".p8")) {
                text += `#import music from ${source}\n`
            }
            else if (source.endsWith(".p8music")) {
                text += `#import music raw from ${source}\n`
            }
        })

        project.text = text
        console.log("Update project text from sources")
    },
    readText: () => {
        project.scriptSources = []
        project.spriteSources = []
        project.mapSources = []
        project.sfxSources = []
        project.musicSources = []

        let lines = project.text.split('\n')
        let pattern = /#(?:include|import) (?:lua|gfx|png|map|tmx|sfx|music) (?:from |raw from )?(.*)/g
        var target = null
        foreach(lines, (line) => {
            if (line.startsWith("__lua__")) target = project.scriptSources
            else if (line.startsWith("__gfx__")) target = project.spriteSources
            else if (line.startsWith("__map__")) target = project.mapSources
            else if (line.startsWith("__sfx__")) target = project.sfxSources
            else if (line.startsWith("__music__")) target = project.musicSources
            else if (target != null) {
                let matches = Array.from(line.matchAll(pattern))
                if (matches.length > 0) {
                    target.push(matches[0][1])
                }
            }
        })
        console.log("Update project sources from text")
    }
}

function setAppFlag(name) {
    document.getElementById("app").classList.add(name)
}
function clearAppFlag(name) {
    document.getElementById("app").classList.remove(name)
}
function blipAppFlag(name) {
    setAppFlag(name)
    setTimeout(() => {
        clearAppFlag(name)
    }, 50)
}

function updateTextElement() {
    document.getElementById("project-text").value = project.text
}
function updateSourceElements() {
    document.getElementById("project-scripts").value = project.scriptSources.length > 0 ? project.scriptSources.join('\n') : ""
    document.getElementById("project-sprites").value = project.spriteSources.length > 0 ? project.spriteSources.join('\n') : ""
    document.getElementById("project-maps").value = project.mapSources.length > 0 ? project.mapSources.join('\n') : ""
    document.getElementById("project-sfx").value = project.sfxSources.length > 0 ? project.sfxSources.join('\n') : ""
    document.getElementById("project-music").value = project.musicSources.length > 0 ? project.musicSources.join('\n') : ""
}
function generateChanges() {
    project.unsavedChanges = true
    setAppFlag("unsaved-changes")
}
function clearChanges() {
    project.unsavedChanges = false
    clearAppFlag("unsaved-changes")
}

function openFile(path) {
    let pathString = path.toString()
    fs.readFile(pathString, (error, text) => {
        if (error) {
            project.open = false

            alert("Error opening file!\n" + error)
            document.getElementById("project-text").value = "Could not open file :("

            clearAppFlag("project-loaded")
            clearAppFlag("unsaved-changes")
        }
        else {
            project.open = true

            project.path = path[0].replace(/\\/g, '/')
            project.name = project.path.substring(project.path.lastIndexOf('/') + 1)
            project.folder = project.path.replace(project.name, "");

            foreach(document.getElementsByClassName("project-name"), (element) => {
                element.innerText = project.name
            })

            project.text = text.toString('utf8')

            setAppFlag("project-loaded")
            clearChanges()

            project.readText()
            updateTextElement()
            updateSourceElements()
        }
    })
}

function openProjectDialog() {
    blipAppFlag("open")
    let newFile = remote.dialog.showOpenDialog(null, {
        title: "Open Project",
        defaultPath: project.path,
        filters: [
            { name: "PicoBuild Projects", extensions: ["pp8"] },
            // { name: "Pico-8 Projects", extensions: ["p8"] }
        ]
    })
    if (newFile != null) {
        openFile(newFile)
    }
}

function saveProject() {
    if (project.open) {
        finishChanges(project.editing)
        blipAppFlag("save")
        fs.writeFile(project.path, project.text, (error) => {
            if (error) {
                alert("Error writing file!\n" + error)
            }
            else {
                clearChanges()
            }
        })
    }
}

function newProjectDialog() {
    blipAppFlag("new")
}

function exportProjectDialog() {
    if (project.open) {
        blipAppFlag("export")
    }
}

function runProject() {
    if (project.open) {
        blipAppFlag("run")
    }
}

function updateProjectFromCode() {
    if (project.open) {
        let code = document.getElementById("project-text").value
        project.text = code

        generateChanges()
    }
}

function startChanges(to) {
    project.editing = to
}

function finishChanges(from) {
    if (project.open) {
        if (from == "code") {
            project.readText()
            updateSourceElements()
        }
        else if (from == "scripts") {
            let input = document.getElementById("project-scripts").value
            project.scriptSources = input.length > 0 ? input.split('\n') : []
            project.generateText()
            updateTextElement()
        }
        else if (from == "sprites") {
            let input = document.getElementById("project-sprites").value
            project.spriteSources = input.length > 0 ? input.split('\n') : []
            project.generateText()
            updateTextElement()
        }
        else if (from == "maps") {
            let input = document.getElementById("project-maps").value
            project.mapSources = input.length > 0 ? input.split('\n') : []
            project.generateText()
            updateTextElement()
        }
        else if (from == "sfx") {
            let input = document.getElementById("project-sfx").value
            project.sfxSources = input.length > 0 ? input.split('\n') : []
            project.generateText()
            updateTextElement()
        }
        else if (from == "music") {
            let input = document.getElementById("project-music").value
            project.musicSources = input.length > 0 ? input.split('\n') : []
            project.generateText()
            updateTextElement()
        }
    }
    generateChanges()

    if (project.editing == from) {
        project.editing = ""
    }
}

var shiftIsPressed = false

window.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        if (event.key == 's') {
            saveProject()
        }
        else if (event.key == 'o') {
            openProjectDialog();
        }
        else if (event.key == 'n') {
            newProjectDialog();
        }
    }
    else if (event.altKey) {
        if (event.key == 'e') {
            exportProjectDialog()
        }
        else if (event.key == 'x') {
            runProject();
        }
    }
}, false)

window.addEventListener('keydown', (event) => {
    if (event.key=="Shift") shiftIsPressed = true
}, true)
window.addEventListener('keyup', (event) => {
    if (event.key=="Shift") shiftIsPressed = false
}, true)

function addFiles(files, target) {
    if (files && files.length > 0) {
        foreach(files, (path) => {
            let file = path.replace(/\\/g, '/').replace(project.folder, "./")
            if (!target.includes(file)) {
                target.push(file)
            }
        })

        project.generateText()
        updateSourceElements()
        updateTextElement()
        generateChanges()
    }
}
function addScripts() {
    if (project.open) {
        blipAppFlag("import")
        var files = null
        if (shiftIsPressed) {
            files = remote.dialog.showOpenDialog(null, {
                title: "Import Directory",
                multiSelections: "true",
                defaultPath: project.folder,
                filters: [
                ],
                properties: [
                    'multiSelections',
                    'openDirectory'
                ]
            })
        }
        else {
            files = remote.dialog.showOpenDialog(null, {
                title: "Import Scripts",
                multiSelections: "true",
                defaultPath: project.folder,
                filters: [
                    { name: "lua scripts", extensions: ["lua"] },
                    { name: "Pico-8 Projects", extensions: ["p8"] }
                ],
                properties: [
                    'multiSelections'
                ]
            })
        }

        addFiles(files, project.scriptSources)
    }
}
function addSprites() {
    if (project.open) {
        blipAppFlag("import")
        var files = null
        if (shiftIsPressed) {
            files = remote.dialog.showOpenDialog(null, {
                title: "Import Directory",
                multiSelections: "true",
                defaultPath: project.folder,
                filters: [
                ],
                properties: [
                    'multiSelections',
                    'openDirectory'
                ]
            })
        }
        else {
            files = remote.dialog.showOpenDialog(null, {
                title: "Import Sprites",
                multiSelections: "true",
                defaultPath: project.folder,
                filters: [
                    { name: "external spritesheets", extensions: ["png"] },
                    { name: "Pico-8 Projects", extensions: ["p8"] }
                ],
                properties: [
                    'multiSelections'
                ]
            })
        }
        addFiles(files, project.spriteSources)
    }
}
function addMaps() {
    if (project.open) {
        blipAppFlag("import")
        var files = null
        if (shiftIsPressed) {
            files = remote.dialog.showOpenDialog(null, {
                title: "Import Directory",
                multiSelections: "true",
                defaultPath: project.folder,
                filters: [
                ],
                properties: [
                    'multiSelections',
                    'openDirectory'
                ]
            })
        }
        else {
            files = remote.dialog.showOpenDialog(null, {
                title: "Import Maps",
                multiSelections: "true",
                defaultPath: project.folder,
                filters: [
                    { name: "Tiled maps", extensions: ["tmx"] },
                    { name: "Pico-8 Projects", extensions: ["p8"] }
                ],
                properties: [
                    'multiSelections'
                ]
            })
        }
        addFiles(files, project.mapSources)
    }
}
function addSfx() {
    if (project.open) {
        blipAppFlag("import")
        let files = remote.dialog.showOpenDialog(null, {
            title: "Import Sfx",
            multiSelections: "true",
            defaultPath: project.folder,
            filters: [
                { name: "Pico-8 Projects", extensions: ["p8"] }
            ],
            properties: [
            ]
        })

        addFiles(files, project.sfxSources)
    }
}
function addMusic() {
    if (project.open) {
        blipAppFlag("import")
        let files = remote.dialog.showOpenDialog(null, {
            title: "Import Music",
            multiSelections: "true",
            defaultPath: project.folder,
            filters: [
                { name: "Pico-8 Projects", extensions: ["p8"] }
            ],
            properties: [
            ]
        })

        addFiles(files, project.musicSources)
    }
}

mouse = {
    x: 0,
    y: 0
}

hoverElement = null
window.addEventListener('mousemove', (event) => {
    mouse.x = event.pageX;
    mouse.y = event.pageY;

    // Since key up can be eaten by file dialogues
    if (shiftIsPressed && !event.shiftKey) {
        shiftIsPressed = false;
    }
})

function showToolTip(element, message, shortcut)
{
    let tooltip = document.getElementById("tooltip")
    hoverElement = element;
    setTimeout(() => {
        if (hoverElement == element) {
            tooltip.classList.add("shown");
            tooltip.innerHTML = `<div class="message">${message}</div><div class="shortcut">${shortcut}</div>`;
            tooltip.style.top = `${mouse.y + 20}px`;
            tooltip.style.left = `${mouse.x - tooltip.offsetWidth / 2 + 10}px`;
        }
    }, 1000)
}
function hideToolTip(element)
{
    if (hoverElement == element)
    {
        hoverElement = null;
        let tooltip = document.getElementById("tooltip")
        tooltip.classList.remove("shown");
    }
}

function test() {
    alert("test")
}