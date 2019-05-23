let childProcess = require('child_process')

// <window>
window.addEventListener('mousemove', (event) => {
    App.input.mouse.x = event.pageX;
    App.input.mouse.y = event.pageY;

    // Since key up can be eaten by file dialogues
    if (App.input.shift && !event.shiftKey) {
        App.input.shift = false;
    }
})

window.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        if (event.key == 's') {
            File.saveProject()
        }
        else if (event.key == 'o') {
            File.openProject();
        }
        else if (event.key == 'n') {
            File.newProject();
        }
    }
    else if (event.altKey) {
        if (event.key == 'e') {
            File.exportProject()
        }
        else if (event.key == 'x') {
            File.runProject();
        }
        else if (event.key == 'w') {
            File.closeProject();
        }
    }
}, true)

window.addEventListener('keydown', (event) => {
    if (event.key == "Shift") App.input.shift = true
}, true)
window.addEventListener('keyup', (event) => {
    if (event.key == "Shift") App.input.shift = false
}, true)
// </window>

const App = {
    input: {
        mouse: { x: 0, y: 0 },
        shift: false
    },

    defaultFolder: "./Projects/",
    noProjectName: "no project",
    settingsPath: "./app.cfg",

    settings: {
        pathToPico8: "",
    },

    close: () => {
        remote.getCurrentWindow().close()
    },

    setFlag: (name) => {
        document.getElementById("app").classList.add(name)
    },
    clearFlag: (name) => {
        document.getElementById("app").classList.remove(name)
    },
    blipFlag: (name) => {
        App.setFlag(name)
        setTimeout(() => {
            App.clearFlag(name)
        }, 50)
    },

    setProjectName: (name) => {
        foreach(document.getElementsByClassName("project-name"), (element) => {
            element.innerText = name
        })
    },
    setProjectText: (text) => {
        document.getElementById("project-text").value = text
    },

    loadSettings: () => {
        if (Path.exists(App.settingsPath)) {
            let text = fs.readFileSync(App.settingsPath, 'utf8')
            App.settings = JSON.parse(text)
        }
        else {
            App.saveSettings()
        }
    },
    saveSettings: () => {
        let text = JSON.stringify(App.settings)
        fs.writeFile(App.settingsPath, text, null, (error) => {
            if (error) {
                printerr(`Failed to save app settings!\n${error}`)
            }
        })
    },

    findPico8: () => {
        let paths = remote.dialog.showOpenDialog(null, {
            title: "Locate Pico-8",
            defaultPath: "./pico8.exe",
            filters: [
                { name: "Executables", extensions: [] }
            ]
        })
        
        if (paths) {
            print("Located Pico-8")
            let path = paths[0]
            App.settings.pathToPico8 = path
            App.saveSettings()
        }
    }
}

App.loadSettings()

const File = {
    currentProject: null,

    getDefaultPath: () => {
        if (File.currentProject && File.currentProject.fileInfo.path != "") {
            return { path: File.currentProject.fileInfo.path, folder: File.currentProject.fileInfo.folder }
        }
        else {
            return { path: App.defaultFolder, folder: App.defaultFolder }
        }
    },

    newProject: () => {
        let savePath = remote.dialog.showSaveDialog(null, {
            title: "Create New Project",
            defaultPath: File.getDefaultPath().folder,
            filters: [
                { name: "PicoBuild Projects", extensions: ["pp8"] }
            ]
        })

        if (savePath) {
            File.currentProject = PicoBuildProject()
            File.currentProject.setPath(savePath)
            
            Edit.updateProjectName()
            Edit.updateProjectText()
            Edit.updateEntryFields()
            App.setFlag("unsaved-changes")
            App.setFlag("project-loaded")
            App.blipFlag("new")
        }
    },
    openProject: () => {
        let openPath = remote.dialog.showOpenDialog(null, {
            title: "Open Project",
            defaultPath: File.getDefaultPath().folder,
            filters: [
                { name: "PicoBuild Projects", extensions: ["pp8"] }
            ]
        })

        if (openPath) {
            let openText = fs.readFileSync(openPath[0], 'utf8')
            let openProject = PicoBuildProjectFromText(openText)
            File.currentProject = openProject

            Edit.updateProjectName()
            Edit.updateProjectText()
            Edit.updateEntryFields()
            App.setFlag("project-loaded")
            App.blipFlag("open")
        }
    },
    saveProject: () => {
        if (File.currentProject) {
            if (Edit.editing != "") {
                Edit.finishTextChanges(Edit.editing)
            }

            if (App.input.shift || File.currentProject.fileInfo.path == "") {
                File.saveProjectAs()
            }
            else {
                App.clearFlag("unsaved-changes")
                App.blipFlag("save")
                File.currentProject.save()
                Edit.updateProjectText()
                Edit.updateEntryFields()
            }
        }
    },
    saveProjectAs: () => {
        let savePath = remote.dialog.showSaveDialog(null, {
            title: "Save Project As",
            defaultPath: File.getDefaultPath().path,
            filters: [
                { name: "PicoBuild Projects", extensions: ["pp8"] }
            ]
        })

        if (savePath) {
            File.currentProject.setPath(savePath)
            File.currentProject.save()

            Edit.updateProjectName()
            Edit.updateProjectText()
            Edit.updateEntryFields()
            App.clearFlag("unsaved-changes")
            App.blipFlag("save")
        }
    },
    exportProject: (allowOpen = true) => {
        if (File.currentProject) {
            App.blipFlag("export")
            let exportProject = File.currentProject.generatePico8Project()
            exportProject.save()

            if (allowOpen && App.input.shift) {
                if (App.settings.pathToPico8 == "") {
                    App.findPico8()
                }
                if (App.settings.pathToPico8 != "") {
                    childProcess.execFile(App.settings.pathToPico8, [ exportProject.fileInfo.path ])
                }
            }

            return exportProject
        }
        return null
    },
    runProject: () => {
        if (File.currentProject) {
            App.blipFlag("run")
            let p8 = File.exportProject(false)
            if (p8) {
                if (App.settings.pathToPico8 == "") {
                    App.findPico8()
                }
                if (App.settings.pathToPico8 != "") {
                    childProcess.execFile(App.settings.pathToPico8, [ "-run", p8.fileInfo.path ])
                }
            }
            else {
                printerr("Failed to export .p8!")
            }
        }
    },
    closeProject: () => {
        if (File.currentProject) {
            File.currentProject = null

            Edit.updateEntryFields()
            Edit.updateProjectText()
            Edit.updateProjectName()
            App.clearFlag("project-loaded")
            App.clearFlag("unsaved-changes")
            App.blipFlag("close")
        }
    },
}

const Edit = {
    updateProjectName: () => {
        if (File.currentProject) {
            App.setProjectName(File.currentProject.fileInfo.name)
        }
        else {
            App.setProjectName(App.noProjectName)
        }
    },
    updateProjectText: () => {
        if (File.currentProject) {
            App.setProjectText(File.currentProject.toString())
        }
        else {
            App.setProjectText("")
        }
    },

    updateEntryFields: () => {
        if (File.currentProject) {
            document.getElementById("project-scripts").value =
                File.currentProject.sources.script.length > 0 ?
                    File.currentProject.sources.script.join('\n') :
                    ""
            document.getElementById("project-maps").value =
                File.currentProject.sources.maps.length > 0 ?
                    File.currentProject.sources.maps.join('\n') :
                    ""
            document.getElementById("project-sprites").value =
                File.currentProject.sources.spriteSheet

            document.getElementById("project-sfx").value =
                File.currentProject.sources.sfx

            document.getElementById("project-music").value =
                File.currentProject.sources.music
        }
        else {
            document.getElementById("project-scripts").value = ""
            document.getElementById("project-maps").value = ""
            document.getElementById("project-sprites").value = ""
            document.getElementById("project-sfx").value = ""
            document.getElementById("project-music").value = ""
        }
    },

    generateChanges: () => {
        if (File.currentProject) {
            App.setFlag("unsaved-changes")
            File.currentProject.editorInfo.unsavedChanges = true
        }
    },

    editing: "",
    startTextChanges: (target) => {
        if (File.currentProject) {
            Edit.editing = target
        }
    },
    finishTextChanges: (target) => {
        if (File.currentProject) {
            if (Edit.editing != "" && Edit.editing == target) {
                var text
                var sources
                switch (target) {
                    case "scripts":
                        text = document.getElementById("project-scripts").value
                        sources = text.split('\n')
                        if (sources.length > 0) {
                            File.currentProject.sources.script = sources.filter((v, i, arr) => { return v != "" })
                            modify(File.currentProject.sources.script, Path.sanitize)
                        }
                        else {
                            File.currentProject.sources.script = []
                        }
                        break
                    case "maps":
                        text = document.getElementById("project-maps").value
                        sources = text.split('\n')
                        if (sources.length > 0) {
                            File.currentProject.sources.maps = sources.filter((v, i, arr) => { return v != "" })
                            modify(File.currentProject.sources.maps, Path.sanitize)
                        }
                        else {
                            File.currentProject.sources.maps = []
                        }
                        break
                    case "sprites":
                        text = document.getElementById("project-sprites").value
                        File.currentProject.sources.spriteSheet = Path.sanitize(text)
                        break
                    case "sfx":
                        text = document.getElementById("project-sfx").value
                        File.currentProject.sources.sfx = Path.sanitize(text)
                        break
                    case "music":
                        text = document.getElementById("project-music").value
                        File.currentProject.sources.music = Path.sanitize(text)
                        break
                }

                Edit.generateChanges()
                Edit.updateProjectText()
                Edit.editing = ""
            }
        }
    },

    addScript: () => {
        if (File.currentProject) {
            if (App.input.shift) {
                Edit.addScriptFolder()
            }
            else {
                let absolutePaths = remote.dialog.showOpenDialog(null, {
                    title: "Import Script",
                    defaultPath: File.getDefaultPath().folder,
                    filters: [
                        { name: "Lua Scripts", extensions: ["lua"] },
                        // { name: "Pico-8 Projects", extensions: ["p8"] }
                    ],
                    properties: [
                        'multiSelections'
                    ]
                })

                if (absolutePaths && absolutePaths.length > 0) {
                    var changed = false
                    if (File.currentProject.fileInfo.folder != "") {
                        absolutePaths.map((path) => {
                            let relativePath = Path.getRelativePath(path, File.currentProject.fileInfo.folder)
                            changed |= File.currentProject.addScriptSource(relativePath)
                        })
                    }
                    else {
                        absolutePaths.map((path) => {
                            changed |= File.currentProject.addScriptSource(path)
                        })
                    }

                    if (changed) {
                        Edit.generateChanges()
                        Edit.updateProjectText()
                        Edit.updateEntryFields()
                    }
                }
            }
        }
    },
    addScriptFolder: () => {
        if (File.currentProject) {
            let absolutePaths = remote.dialog.showOpenDialog(null, {
                title: "Import Script Folder",
                defaultPath: File.getDefaultPath().folder,
                properties: [
                    'openDirectory',
                    'multiSelections'
                ]
            })

            if (absolutePaths && absolutePaths.length > 0) {
                var changed = false
                if (File.currentProject.fileInfo.folder != "") {
                    absolutePaths.map((path) => {
                        let relativePath = Path.getRelativePath(path, File.currentProject.fileInfo.folder)
                        changed |= File.currentProject.addScriptSource(relativePath)
                    })
                }
                else {
                    absolutePaths.map((path) => {
                        changed |= File.currentProject.addScriptSource(path)
                    })
                }

                if (changed) {
                    Edit.generateChanges()
                    Edit.updateProjectText()
                    Edit.updateEntryFields()
                }
            }
        }
    },
    setSprites: () => {
        if (File.currentProject) {
            let absolutePaths = remote.dialog.showOpenDialog(null, {
                title: "Import Sprite Sheet",
                defaultPath: File.getDefaultPath().folder,
                filters: [
                    { name: "PNG Images", extensions: ["png"] },
                    { name: "Pico-8 Projects", extensions: ["p8"] }
                ]
            })

            if (absolutePaths && absolutePaths.length > 0) {
                let absolutePath = absolutePaths[0]
                var changed = false

                if (File.currentProject.fileInfo.folder != "") {
                    let relativePath = Path.getRelativePath(absolutePath, File.currentProject.fileInfo.folder)
                    changed |= File.currentProject.setSpriteSheetSource(relativePath)
                }
                else {
                    changed |= File.currentProject.setSpriteSheetSource(absolutePath)
                }

                if (changed) {
                    Edit.generateChanges()
                    Edit.updateProjectText()
                    Edit.updateEntryFields()
                }
            }
        }
    },
    addMap: () => {
        if (File.currentProject) {
            if (App.input.shift) {
                Edit.addMapFolder()
            }
            else {
                let absolutePaths = remote.dialog.showOpenDialog(null, {
                    title: "Import Map",
                    defaultPath: File.getDefaultPath().folder,
                    filters: [
                        { name: "Tiled Maps", extensions: ["tmx"] }
                    ],
                    properties: [
                        'multiSelections'
                    ]
                })

                if (absolutePaths && absolutePaths.length > 0) {
                    var changed = false
                    if (File.currentProject.fileInfo.folder != "") {
                        absolutePaths.map((path) => {
                            let relativePath = Path.getRelativePath(path, File.currentProject.fileInfo.folder)
                            changed |= File.currentProject.addMapSource(relativePath)
                        })
                    }
                    else {
                        absolutePaths.map((path) => {
                            changed |= File.currentProject.addMapSource(path)
                        })
                    }

                    if (changed) {
                        Edit.generateChanges()
                        Edit.updateProjectText()
                        Edit.updateEntryFields()
                    }
                }
            }
        }
    },
    addMapFolder: () => {
        if (File.currentProject) {
            let absolutePaths = remote.dialog.showOpenDialog(null, {
                title: "Import Map Folder",
                defaultPath: File.getDefaultPath().folder,
                properties: [
                    'openDirectory',
                    'multiSelections'
                ]
            })

            if (absolutePaths && absolutePaths.length > 0) {
                var changed = false
                if (File.currentProject.fileInfo.folder != "") {
                    absolutePaths.map((path) => {
                        let relativePath = Path.getRelativePath(path, File.currentProject.fileInfo.folder)
                        changed |= File.currentProject.addMapSource(relativePath)
                    })
                }
                else {
                    absolutePaths.map((path) => {
                        changed |= File.currentProject.addMapSource(path)
                    })
                }

                if (changed) {
                    Edit.generateChanges()
                    Edit.updateProjectText()
                    Edit.updateEntryFields()
                }
            }
        }
    },
    setSfx: () => {
        if (File.currentProject) {
            let absolutePaths = remote.dialog.showOpenDialog(null, {
                title: "Import Sfx",
                defaultPath: File.getDefaultPath().folder,
                filters: [
                    { name: "Pico-8 Projects", extensions: ["p8"] }
                ]
            })

            if (absolutePaths && absolutePaths.length > 0) {
                print(absolutePaths)
                let absolutePath = absolutePaths[0]
                var changed = false

                if (File.currentProject.fileInfo.folder != "") {
                    let relativePath = Path.getRelativePath(absolutePath, File.currentProject.fileInfo.folder)
                    changed |= File.currentProject.setSfxSource(relativePath)
                }
                else {
                    changed |= File.currentProject.setSfxSource(absolutePath)
                }

                if (changed) {
                    Edit.generateChanges()
                    Edit.updateProjectText()
                    Edit.updateEntryFields()
                }
            }
        }
    },
    setMusic: () => {
        if (File.currentProject) {
            let absolutePaths = remote.dialog.showOpenDialog(null, {
                title: "Import Music",
                defaultPath: File.getDefaultPath().folder,
                filters: [
                    { name: "Pico-8 Projects", extensions: ["p8"] }
                ]
            })

            if (absolutePaths && absolutePaths.length > 0) {
                print(absolutePaths)
                let absolutePath = absolutePaths[0]
                var changed = false

                if (File.currentProject.fileInfo.folder != "") {
                    let relativePath = Path.getRelativePath(absolutePath, File.currentProject.fileInfo.folder)
                    changed |= File.currentProject.setMusicSource(relativePath)
                }
                else {
                    changed |= File.currentProject.setMusicSource(absolutePath)
                }

                if (changed) {
                    Edit.generateChanges()
                    Edit.updateProjectText()
                    Edit.updateEntryFields()
                }
            }
        }
    },

    editSource: (name) => {
        if (File.currentProject) {
            var path = ""
            switch (name) {
                case 'sprites':
                    path = File.currentProject.getGfxProject()
                    break
                case 'sfx':
                    path = File.currentProject.sources.sfx
                    break
                case 'music':
                    path = File.currentProject.sources.music
                    break
            }

            if (path != "") {
                path = Path.getAbsolutePath(path, File.currentProject.fileInfo.folder)
                if (App.settings.pathToPico8 == "") {
                    App.findPico8()
                }
                if (App.settings.pathToPico8 != "") {
                    childProcess.execFile(App.settings.pathToPico8, [ path ])
                }
            }
        }
    },
}

const Tooltip = {
    hoverElement: null,

    show: (element, message, shortcut) => {
        let tooltip = document.getElementById("tooltip")
        Tooltip.hoverElement = element;
        setTimeout(() => {
            if (Tooltip.hoverElement == element) {
                tooltip.classList.add("shown");
                tooltip.innerHTML = `<div class="message">${message}</div><div class="shortcut">${shortcut}</div>`;
                tooltip.style.top = `${App.input.mouse.y + 20}px`;
                var left = App.input.mouse.x - tooltip.offsetWidth / 2 + 10
                if (left < 3) { left = 3 }
                let right = left + tooltip.offsetWidth
                if (right > window.innerWidth - 3) {
                    left -= right - window.innerWidth + 3
                }

                tooltip.style.left = `${left}px`;
            }
        }, 1000)
    },
    hide: (element) => {
        if (Tooltip.hoverElement == element) {
            Tooltip.hoverElement = null;
            let tooltip = document.getElementById("tooltip")
            tooltip.classList.remove("shown");
        }
    }
}