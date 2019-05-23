// Node modules
const remote = require('electron').remote
const fs = require('fs')
const pathUtil = require('path')
const readPNG = remote.require('./main').readPNG
const writePNG = remote.require('./main').writePNG

// Functions
function vec2(nx, ny) {
    return { x: nx, y: ny }
}

function foreach(arr, f) {
    for (var i = 0; i < arr.length; i++) {
        f(arr[i])
    }
}

function modify(arr, f) {
    for (var i = 0; i < arr.length; i++) {
        arr[i] = f(arr[i])
    }
}

let print = console.log
let printerr = console.warn
let notImplemented = (func) => {
    console.error(`${func} is not implemented!`)
}

// Library functions
const Path = {
    sanitize: (path) => {
        // Change windows separators to standard
        return path.replace(/\\/g, '/')
    },
    getFileName: (path) => {
        // Get the file name from a path
        return path.substring(path.lastIndexOf('/') + 1)
    },
    getExtension: (path) => {
        return path.substring(path.lastIndexOf(".") + 1)
    },
    getAbsolutePath: (path, rootDirectory) => {
        let originalCWD = process.cwd()
        process.chdir(rootDirectory)
        let absolutePath = pathUtil.resolve(path)
        process.chdir(originalCWD)
        
        return Path.sanitize(absolutePath)
    },
    getRelativePath: (path, relativeTo) => {
        var relativePath = pathUtil.relative(relativeTo, path)
        if (relativePath == "") {
            relativePath = "./"
        }
        return Path.sanitize(relativePath)
    },
    exists: (path) => {
        let fileExists = fs.existsSync(path)
        return fileExists
    },
    isDirectory: (path) => {
        let stat = fs.statSync(path)
        if (stat != null && stat.isDirectory()) {
            return true
        }
        else {
            return false
        }
    }
}

const Pico8 = {
    colors: {
        '0': [0, 0, 0, 0],
        '1': [29, 43, 83, 255],
        '2': [126, 37, 83, 255],
        '3': [0, 135, 81, 255],
        '4': [171, 82, 54, 255],
        '5': [95, 87, 79, 255],
        '6': [194, 195, 199, 255],
        '7': [255, 241, 232, 255],
        '8': [255, 0, 77, 255],
        '9': [255, 163, 0, 255],
        'a': [255, 236, 39, 255],
        'b': [0, 228, 54, 255],
        'c': [41, 173, 255, 255],
        'd': [131, 118, 156, 255],
        'e': [255, 119, 128, 255],
        'f': [255, 204, 17, 255],
        
        '0 0 0 0': '0',
        '29 43 83 255': '1',
        '126 37 83 255': '2',
        '0 135 81 255': '3',
        '171 82 54 255': '4',
        '95 87 79 255': '5',
        '194 195 199 255': '6',
        '255 241 232 255': '7',
        '255 0 77 255': '8',
        '255 163 0 255': '9',
        '255 236 39 255': 'a',
        '0 228 54 255': 'b',
        '41 173 255 255': 'c',
        '131 118 156 255': 'd',
        '255 119 128 255': 'e',
        '255 204 17 255': 'f'
    },

    project: {
        gfxTemplate: "pico-8 cartridge // http://www.pico-8.com\nversion 16\n__lua__\n--> only edit sprites! ^\n--> picobuild\n--> gfx template project\n\n__gfx__\n"
    },

    extractSegment: (projectText, segmentName) => {
        let pattern = RegExp(`(__${segmentName}__)(\\s+)([\\s\\S]+?)(\\s+__\\S+__|\\s*$)`, 'g')
        let matches = Array.from(projectText.matchAll(pattern))
        
        if (matches.length > 0) {
            let segmentText = matches[0][3]
            return segmentText
        }
        else {
            return ""
        }
    },
    replaceSegment: (projectText, segmentName, content) => {
        let pattern = RegExp(`(__${segmentName}__)(\\s+)([\\s\\S]+?)(\\s+__\\S+__|\\s*$)`, 'g')
        let replacement = `$1$2${content}$4`
        return projectText.replace(pattern, replacement)
    },
    convertToText: (pngImage) => {
        let data = pngImage.data
        var gfxText = ""
        var n = 0
        for (var i = 0; i < data.length; i += 4) {
            let rgba = `${data[i+0]} ${data[i+1]} ${data[i+2]} ${data[i+3]}`
            let p8Color = Pico8.colors[rgba]
            
            if (p8Color) {
                gfxText += p8Color
            }
            else {
                printerr(`Invalid color (${rgba})`)
            }

            n += 1
            if (n % 128 == 0) {
                gfxText += "\n"
            }
        }
        return gfxText
    },
    generateGfxProject: (projectPath, pngImage) => {
        let gfxText = Pico8.convertToText(pngImage)
        fs.writeFileSync(projectPath, Pico8.project.gfxTemplate + gfxText)
    },
    updateGfxProject: (projectPath, pngImage) => {
        let projectText = fs.readFileSync(projectPath, 'utf8')
        let gfxText = Pico8.convertToText(pngImage)
        let newText = Pico8.replaceSegment(projectText, 'gfx', gfxText)
        fs.writeFileSync(projectPath, newText)
    }
}

const Tmx = {
    infoPattern: /<map .+? width="(\d+)" height="(\d+)" .+?>/g,
    // groups: width, height
    layerPattern: /<layer .+? name="(.+?)" (.+?)>\s+?<data encoding="csv">\s+?([\s\S]+?)\s<\/data>\s+?<\/layer>/g,
    // groups: name, properties (incl. visible), data

    getSize: (text) => {
        let matches = Array.from(text.matchAll(Tmx.infoPattern))
        if (matches.length > 0) {
            let match = matches[0]
            let size = vec2(parseInt(match[1]), parseInt(match[2]))
            return size
        }
        else {
            return vec2(0, 0)
        }
    },

    getLayers: (text) => {
        var layers = []
        let matches = Array.from(text.matchAll(Tmx.layerPattern))
        matches.map((match) => {
            let properties = match[2]
            let data = match[3]

            // Skip hidden layers
            if (!properties.includes('visible="0"')) {
                var layer = {
                    name: match[1],
                    data: []
                }

                let rows = data.split('\n')
                rows.map((row) => {
                    if (row != "") {
                        var rowData = []
                        let tiles = row.split(',')
                        tiles.map((tile) => {
                            var value = parseInt(tile)
                            if (!isNaN(value)) {
                                if (value > 0) { value -= 1 } // Tiled is 1 indexed, Pico-8 is 0 indexed but 0 is still empty...
                                rowData.push(value)
                            }
                        })
                        layer.data.push(rowData)
                    }
                })
    
                layers.push(layer)
            }
        })

        return layers
    }
}

// Data structures
function PicoBuildProject() {
    var newProject = {
        fileInfo: {
            name: "",
            folder: "",
            path: "",
        },
        editorInfo: {
            unsavedChanges: true,
        },
        sources: {
            script: [],
            spriteSheet: "",
            maps: [],
            sfx: "",
            music: ""
        },

    }

    let self = newProject

    self.addScriptSource = (sourcePath) => {
        let path = Path.sanitize(sourcePath)
        if (self.sources.script.includes(path)) {
            return false
        }
        else {
            self.sources.script.push(path)
            return true
        }
    }
    self.addMapSource = (sourcePath) => {
        let path = Path.sanitize(sourcePath)
        if (self.sources.maps.includes(path)) {
            return false
        }
        else {
            self.sources.maps.push(path)
            return true
        }
    }
    self.setSpriteSheetSource = (sourcePath) => {
        let path = Path.sanitize(sourcePath)
        if (self.sources.spriteSheet == path) {
            return false
        }
        else {
            self.sources.spriteSheet = path
            return true
        }
    }
    self.setSfxSource = (sourcePath) => {
        let path = Path.sanitize(sourcePath)
        if (self.sources.sfx == path) {
            return false
        }
        else {
            self.sources.sfx = path
            return true
        }
    }
    self.setMusicSource = (sourcePath) => {
        let path = Path.sanitize(sourcePath)
        if (self.sources.music == path) {
            return false
        }
        else {
            self.sources.music = path
            return true
        }
    }

    self.toString = () => {
        return JSON.stringify(self, null, ' ')
    }

    self.setPath = (path) => {
        let originalFolder = self.fileInfo.folder
        path = Path.sanitize(path)
        self.fileInfo.path = path
        self.fileInfo.name = Path.getFileName(path)
        self.fileInfo.folder = path.replace(self.fileInfo.name, "")

        var updatePath
        if (originalFolder.length > 0) {
            updatePath = (oldPath) => {
                if (oldPath.length > 0) {
                    let absolutePath = Path.getAbsolutePath(oldPath, originalFolder)
                    let relativePath = Path.getRelativePath(absolutePath, self.fileInfo.folder)
                    return relativePath
                }
                else {
                    return ""
                }
            }
        }
        else {
            updatePath = (absolutePath) => {
                if (absolutePath.length > 0) {
                    let relativePath = Path.getRelativePath(absolutePath, self.fileInfo.folder)
                    return relativePath
                }
                else {
                    return ""
                }
            }
        }

        modify(self.sources.script, updatePath)
        self.sources.spriteSheet = updatePath(self.sources.spriteSheet)
        modify(self.sources.maps, updatePath)
        self.sources.sfx = updatePath(self.sources.sfx)
        self.sources.music = updatePath(self.sources.music)
    }
    self.save = () => {
        self.editorInfo.unsavedChanges = false
        fs.writeFileSync(self.fileInfo.path, self.toString())
    }

    self.getGfxProject = () => {
        let absolutePath = Path.getAbsolutePath(self.sources.spriteSheet, self.fileInfo.folder)
        let gfxExtension = Path.getExtension(self.sources.spriteSheet)

        if (gfxExtension == "p8") {
            return absolutePath
        }
        else if (gfxExtension == "png") {
            // Generate gfx project if needed
            let gfxProjectPath = absolutePath.replace(".png", ".gfx.p8")
            let fileData = fs.readFileSync(absolutePath, null)
            
            let image = readPNG(fileData)
            
            if (Path.exists(gfxProjectPath)) {
                Pico8.updateGfxProject(gfxProjectPath, image)
            }
            else {
                Pico8.generateGfxProject(gfxProjectPath, image)
            }

            return gfxProjectPath
        }
    }

    self.generatePico8Project = () => {
        var exportProject = Pico8Project()
        exportProject.fileInfo.path = self.fileInfo.path.replace(".pp8", ".export.p8")

        // Add Scripts
        if (self.sources.script.length > 0) {
            let addScriptToExportProject = (sourcePath, sourceDirectory) => {
                let absolutePath = Path.getAbsolutePath(sourcePath, sourceDirectory)
                if (Path.isDirectory(absolutePath)) {
                    let items = fs.readdirSync(absolutePath)
                    items.map((item) => { addScriptToExportProject(item, absolutePath) })
                }
                else {
                    let text = fs.readFileSync(absolutePath, 'utf8')
                    exportProject.addLua(`--> ${sourcePath}\n${text}`)
                }
            }
            self.sources.script.map((source) => { addScriptToExportProject(source, self.fileInfo.folder) })
        }

        // Add spritesheet
        if (self.sources.spriteSheet != "") {
            let transferSpriteSheetToExportProject = (text) => {
                let gfxText = Pico8.extractSegment(text, "gfx")
                let gffText = Pico8.extractSegment(text, "gff")
    
                exportProject.setGfx(gfxText)
                exportProject.setGff(gffText)
            }
    
            let gfxAbsolutePath = Path.getAbsolutePath(self.sources.spriteSheet, self.fileInfo.folder)
            let gfxExtension = Path.getExtension(self.sources.spriteSheet)
    
            if (gfxExtension == "p8") {
                let text = fs.readFileSync(gfxAbsolutePath, 'utf8')
                transferSpriteSheetToExportProject(text)
            }
            else if (gfxExtension == "png") {
                // Generate gfx project if needed
                let gfxProjectPath = self.getGfxProject()
                let text = fs.readFileSync(gfxProjectPath, 'utf8')
                transferSpriteSheetToExportProject(text)
            }
        }

        // Add sfx
        if (self.sources.sfx != "") {
            let sfxAbsolutePath = Path.getAbsolutePath(self.sources.sfx, self.fileInfo.folder)
            let text = fs.readFileSync(sfxAbsolutePath, 'utf8')
            let sfxText = Pico8.extractSegment(text, "sfx")
            exportProject.setSfx(sfxText)
        }
        
        // Add music
        if (self.sources.music != "") {
            let musicAbsolutePath = Path.getAbsolutePath(self.sources.music, self.fileInfo.folder)
            let text = fs.readFileSync(musicAbsolutePath, 'utf8')
            let musicText = Pico8.extractSegment(text, "music")
            exportProject.setMusic(musicText)
        }

        // Add maps
        if (self.sources.maps.length > 0) {
            let addMapToExportProject = (sourcePath, sourceDirectory) => {
                let absolutePath = Path.getAbsolutePath(sourcePath, sourceDirectory)
                if (Path.isDirectory(absolutePath)) {
                    let items = fs.readdirSync(absolutePath)
                    items.map((item) => { addScriptToExportProject(item, absolutePath) })
                }
                else {
                    exportProject.map.addRoom(MapRoom(absolutePath))
                }
            }
            self.sources.maps.map((source) => { addMapToExportProject(source, self.fileInfo.folder) })
        }

        return exportProject
    }

    return newProject
}
function PicoBuildProjectFromText(text) {
    let newProject = PicoBuildProject()
    let openData = JSON.parse(text)
    for (const pair of Object.entries(openData)) {
        newProject[pair[0]] = pair[1]
    }

    return newProject
}

function MapRoom(tmxPath) {
    let tmxText = fs.readFileSync(tmxPath, 'utf8')
    var newRoom = {
        name: Path.getFileName(tmxPath).replace(".tmx", ""),
        size: Tmx.getSize(tmxText),
        origin: vec2(0, 0),
        layers: Tmx.getLayers(tmxText)
        // { name, data[] }
    }

    let self = newRoom

    self.getTotalSize = () => {
        return vec2(self.size.x * self.layers.length, self.size.y)
    }

    // TODO: Vertify this works properly
    self.compactLayers = () => {
        var finalLayers = []
        let addEmptyLayer = (type) => {
            var layer = {
                name: type,
                data: []
            }

            for (var y = 0; y < self.size.y; y++) {
                var row = []
                for (var x = 0; x < self.size.x; x ++) {
                    row.push(0)
                }
                layer.data.push(row)
            }
            finalLayers.push(layer)
            return layer
        }

        let fgLayers = self.layers.filter((item) => {
            return item.name.includes("fg")
        })
        let bgLayers = self.layers.filter((item) => {
            return !fgLayers.includes(item)
        })

        for (var y = 0; y < self.size.y; y++) {
            for (var x = 0; x < self.size.x; x++) {
                // Make background layers compact
                bgLayers.map((layer) => {
                    let layerValue = layer.data[y][x]
                    var tilePlaced = false
                    
                    // Find a final layer to place tile on
                    finalLayers.map((finalLayer) => {
                        if (tilePlaced) { return }

                        let finalLayerValue = finalLayer.data[y][x]
                        if (finalLayerValue == 0) {
                            finalLayer.data[y][x] = layerValue
                            tilePlaced = true
                        }
                    })

                    // Create a new layer if no final layer can fit the tile
                    if (!tilePlaced) {
                        let newLayer = addEmptyLayer("bg")
                        newLayer.data[y][x] = layerValue
                    }
                })
                
                // Make foreground layers compact
                fgLayers.map((layer) => {
                    let layerValue = layer.data[y][x]
                    var tilePlaced = false
                    
                    // Find a final layer to place tile on
                    finalLayers.map((finalLayer) => {
                        if (tilePlaced || finalLayer.name != "fg") { return }

                        let finalLayerValue = finalLayer.data[y][x]
                        if (finalLayerValue == 0) {
                            finalLayer.data[y][x] = layerValue
                            tilePlaced = true
                        }
                    })

                    // Create a new layer if no final layer can fit the tile
                    if (!tilePlaced) {
                        let newLayer = addEmptyLayer("fg")
                        newLayer.data[y][x] = layerValue
                    }
                })
            }
        }

        self.layers = finalLayers
    }

    return newRoom
}

// A full map data structure (Pico-8 __map__ segment)
function Map(sizeX, sizeY) {
    var newMap = {
        size: vec2(sizeX, sizeY),
        rooms: [],
        regions: [{
            origin: vec2(0, 0),
            size: vec2(sizeX, sizeY)
        }]
    }

    let self = newMap

    self.addRoom = (room) => {
        room.compactLayers()
        let totalRoomSize = room.getTotalSize()
        var roomPlaced = false

        // Find a region that can fit the room (first fit)
        for (var i = 0; i < self.regions.length; i++) {
            let region = self.regions[i]
            if (totalRoomSize.x <= region.size.x && totalRoomSize.y <= region.size.y) {
                let right = {
                    origin: vec2(region.origin.x + totalRoomSize.x, region.origin.y),
                    size: vec2(region.size.x - totalRoomSize.x, region.size.y)
                }
                let under = {
                    origin: vec2(region.origin.x, region.origin.y * totalRoomSize.y),
                    size: vec2(totalRoomSize.x, region.size.y - totalRoomSize.y)
                }

                // replace region with two subregions
                self.regions.splice(i, 1)
                self.regions.push(right)
                self.regions.push(under)

                room.origin = vec2(region.origin.x, region.origin.y)
                self.rooms.push(room)

                roomPlaced = true
                break
            }
        }

        if (roomPlaced) {
            print(`placed room\n${room}`)
        }
        else {
            printerr(`Failed to place room!\n${room}`)
        }
    }

    self.generateMapDefs = () => {
        if (self.rooms.length == 0) {
            return ""
        }

        let mapdefTemplate = "mapdefs = { }"
        let mapdefRoomTemplate = "mapdefs[\"$name\"] = {\n name=\"$name\",\n size = { x=$sizex, y=$sizey },\n layers = {\n$layers\n }\n}\n"
        let mapdefLayerTemplate = "  { name=\"$name\", origin={ x=$originx, y=$originy } },\n"

        var roomText = ""
        self.rooms.map((room) => {
            var layerDefs = ""
            var layer_index = 0
            room.layers.map((layer) => {
                layerDefs += mapdefLayerTemplate.replace("$name", layer.name).replace("$originx", room.origin.x + room.size.x * layer_index).replace("$originy", room.origin.y)
                layer_index += 1
            })
            let roomDef = mapdefRoomTemplate.replace(/\$name/g, room.name).replace("$sizex", room.size.x).replace("$sizey", room.size.y).replace("$layers", layerDefs)
            roomText += roomDef
        })

        return `--> picobuild map import\n${mapdefTemplate}\n${roomText}\n--> end map import`
    }

    self.toString = () => {
        var tiles = []
        for (var y = 0; y < self.size.y; y++) {
            var row = []
            for (var x = 0; x < self.size.x; x++) {
                row.push(0)
            }
            tiles.push(row)
        }

        self.rooms.map((room) => {
            for (var y = 0; y < room.size.y; y++) {
                var tile_y = room.origin.y + y
                for (var x = 0; x < room.size.x; x++) {
                    for (var l = 0; l < room.layers.length; l++) {
                        var tile_x = room.origin.x + x + room.size.x * l
                        tiles[tile_y][tile_x] = room.layers[l].data[y][x]
                    }
                }
            }
        })

        var result = ""
        tiles.map((row) => {
            row.map((tile) => {
                var hex = tile.toString(16)
                if (hex.length == 1) hex = "0" + hex
                result += hex
            })
            result += "\n"
        })

        return result
    }

    return newMap
}

// Data structure to hold all info needed to generate valid Pico-8 project text
function Pico8Project() {
    var newProject = {
        fileInfo: {
            name: "",
            path: ""
        },
        lua: [],
        gfx: "",
        gff: "",
        map: Map(128, 32),
        sfx: "",
        music: "",
    }

    let self = newProject

    self.addLua = (luaText) => {
        self.lua.push(luaText.trim())
    }
    self.setGfx = (gfxText) => {
        self.gfx = gfxText.trim()
    }
    self.setGff = (gffText) => {
        self.gff = gffText.trim()
    }
    self.setSfx = (sfxText) => {
        self.sfx = sfxText.trim()
    }
    self.setMusic = (musicText) => {
        self.music = musicText.trim()
    }

    self.save = () => {
        var text = "pico-8 cartridge // http://www.pico-8.com\nversion 16\n"
        
        let fullLua = self.lua.join("\n")
        fullLua += "\n" + self.map.generateMapDefs()
        text += `__lua__\n${fullLua}\n\n`

        text += `__gfx__\n${self.gfx}\n\n`
        text += `__gff__\n${self.gff}\n\n`

        let mapText = self.map.toString()
        text += `__map__\n${mapText}\n`

        text += `__sfx__\n${self.sfx}\n\n`
        text += `__music__\n${self.music}\n\n`

        fs.writeFileSync(self.fileInfo.path, text)
    }

    return newProject
}