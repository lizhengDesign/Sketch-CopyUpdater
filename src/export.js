import dialog from "@skpm/dialog"
const fs = require("@skpm/fs")
const UI = require("sketch/ui")
const sketch = require("sketch")
const ExcelJS = require("exceljs")
const Settings = sketch.Settings
const doc = sketch.getSelectedDocument()
const creator = "Sketch Plugin: Copy Updater - " + doc.id
const selectedLayers = doc.selectedLayers
const indexMarkerName = "@indexMarker"

let base64ImgList = []
let copyList = []
let scale = 1

const layerType = {
    PAGE: "Page",
    ARTBOARD: "Artboard",
    SHAPEPATH: "ShapePath",
    SHAPE: "Shape",
    TEXT: "Text",
    SYMBOLINSTANCE: "SymbolInstance",
    SYMBOLMASTER: "SymbolMaster",
    SLICE: "Slice",
    HOTSPOT: "HotSpot",
    GROUP: "Group",
}

const prefernceKey = {
    KEY: "lzhengCopyUpdaterKey",
    JSON_PATH: "lzhengCopyUPdaterJSONPath",
    EXPORT_ORIENTATION: "exportOrientation",
    EXPORT_SLICE_ONLY: "exportSliceOnly",
    EXPORT_AT_COPY_COPY: "exportAtCopyOnly",
    HAS_COPY_REVISION: "hasCopyRevision",
    EXPORT_INVIEW_ONLY: "exportInViewOnly",
}
const charNewLine = String.fromCharCode(10)
const exportSliceOnly = Settings.settingForKey(prefernceKey.EXPORT_SLICE_ONLY)
const exportAtCopyOnly = Settings.settingForKey(prefernceKey.EXPORT_AT_COPY_COPY)
const isHorizontal = Settings.settingForKey(prefernceKey.EXPORT_ORIENTATION) === 0
const hasCopyRevision = Settings.settingForKey(prefernceKey.HAS_COPY_REVISION)
const exportInViewOnly = Settings.settingForKey(prefernceKey.EXPORT_INVIEW_ONLY)

const imgBolder = {
    bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
    left: { style: "thin", color: { argb: "FFFFFFFF" } },
    right: { style: "think", color: { argb: "FFFFFFFF" } },
}
const copyAlignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 2 }

const addFormattingForCopyRevision = (worksheet, ref, formulae) => {
    if (hasCopyRevision) {
        worksheet.addConditionalFormatting({
            ref: ref,
            rules: [
                {
                    type: "expression",
                    formulae: [formulae],
                    style: { font: { color: { argb: "FFFF3333" }, bold: true } },
                },
                {
                    type: "expression",
                    formulae: [formulae],
                    style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFCCCC" } } },
                },
            ],
        })
    }
}

const getColLetterByNumber = (int) => {
    let col = ""
    for (let a = 1, b = 26; (int -= a) >= 0; a = b, b *= 26) {
        col = String.fromCharCode(parseInt((int % b) / a) + 65) + col
    }
    return col
}

const generateHorizontalSheet = (workbook, worksheet, currentCopyTitle) => {
    const rowHeight = 40

    const colUnit = hasCopyRevision ? 6 : 5

    worksheet.properties.defaultRowHeight = rowHeight
    worksheet.views = [{ state: "frozen", ySplit: 1 }]
    worksheet.pageSetup = {
        orientation: hasCopyRevision ? "landscape" : "portrait",
        fitToPage: true,
        fitToWidth: base64ImgList.length,
        fitToHeight: 1,
    }

    const headerRow = worksheet.getRow(1)
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } }

    base64ImgList.forEach((imgItem, i) => {
        let copys = []
        const scaledImgWidth = imgItem.width / scale
        const screenName = copyList[i][0].text
        const tableName = ["\\", i + 1, "_", screenName.replace(/[^A-Z0-9]+/gi, "_")].join("")
        const imgCol = worksheet.getColumn(i * colUnit + 1)
        const indexCol = worksheet.getColumn(i * colUnit + 2)
        const keyCol = worksheet.getColumn(i * colUnit + 3)
        const copyCol = worksheet.getColumn(i * colUnit + 4)
        const revisionCol = worksheet.getColumn(i * colUnit + 5)
        const dividerCol = worksheet.getColumn(i * colUnit + colUnit)

        copyList[i].slice(1).forEach((copyItem, index) => {
            copys.push(
                hasCopyRevision
                    ? [, index + 1, copyItem.key, copyItem.text, copyItem.text]
                    : [, index + 1, copyItem.key, copyItem.text]
            )
        })

        const coloumns = [
            { name: `${i + 1}. ${screenName}` },
            { name: "Id" },
            { name: "Key" },
            { name: currentCopyTitle },
        ]

        worksheet.addTable({
            name: tableName,
            ref: getColLetterByNumber(i * colUnit + 1) + 1,
            headerRow: true,
            columns: hasCopyRevision ? [...coloumns, { name: "Copy Revision" }] : [...coloumns],
            rows: [...copys],
        })

        imgCol.width = scaledImgWidth / 8
        indexCol.width = 15
        indexCol.font = { size: 14 }
        indexCol.alignment = copyAlignment
        keyCol.width = 30
        keyCol.font = { size: 14 }
        keyCol.alignment = copyAlignment
        copyCol.width = 60
        copyCol.font = { size: 14 }
        copyCol.alignment = copyAlignment
        dividerCol.width = 4
        dividerCol.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF999999" } }
        imgCol.border = imgBolder
        copyCol.border = {
            right: { style: "think", color: { argb: "FFFFFFFF" } },
        }

        if (hasCopyRevision) {
            revisionCol.width = 60
            revisionCol.font = { size: 14, color: { argb: "FFBBBBBB" } }
            revisionCol.alignment = copyAlignment
            revisionCol.border = {
                right: { style: "think", color: { argb: "FFFFFFFF" } },
            }
            const copyColLetter = getColLetterByNumber(i * colUnit + 4)
            const revisionColLetter = getColLetterByNumber(i * colUnit + 5)
            addFormattingForCopyRevision(
                worksheet,
                "$" + revisionColLetter + ":$" + revisionColLetter,
                "$" + revisionColLetter + "1<>$" + copyColLetter + "1"
            )
        }

        const scaledImgHeight = scaledImgWidth * imgItem.ratio

        const image = workbook.addImage({
            base64: imgItem.img,
            extension: "jpeg",
        })
        worksheet.addImage(image, {
            tl: { col: i * colUnit, row: 1 },
            br: { col: i * colUnit + 1, row: scaledImgHeight / rowHeight / 1.25 },
        })
    })

    headerRow.font = { bold: true, size: 20 }
    headerRow.alignment = { vertical: "middle" }
}

const getRowCount = (text, colWidth) => {
    const paragraphList = text.split(charNewLine)
    let count = 0
    paragraphList.forEach((paragraph) => {
        if (paragraph.length === 0) {
            count++
        } else count += Math.ceil(paragraph.length / colWidth)
    })
    return count
}

const generateVerticalSheet = (workbook, worksheet, currentCopyTitle) => {
    const scaledImgWidth = base64ImgList[0].width / scale
    const columnWidth = 80
    const heightUnit = 20
    const imgCol = worksheet.getColumn(1)
    const indexCol = worksheet.getColumn(2)
    const keyCol = worksheet.getColumn(3)
    const copyCol = worksheet.getColumn(4)
    const revisionCol = worksheet.getColumn(5)
    let currentRow = 1

    worksheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: base64ImgList.length,
        printArea: "",
    }

    const fontStyle = { size: 14 }

    indexCol.width = columnWidth / 8
    indexCol.font = fontStyle
    keyCol.width = columnWidth / 2
    keyCol.font = fontStyle
    copyCol.width = columnWidth
    copyCol.font = fontStyle
    imgCol.width = scaledImgWidth / 8
    if (hasCopyRevision) {
        revisionCol.width = columnWidth
        revisionCol.font = { size: 14, color: { argb: "FFBBBBBB" } }
    }

    base64ImgList.forEach((imgItem, i) => {
        const screenName = copyList[i][0].text
        const tableName = ["\\", i + 1, "_", screenName.replace(/[^A-Z0-9]+/gi, "_")].join("")
        let copys = []
        const scaledImgHeight = scaledImgWidth * imgItem.ratio
        const headerRow = worksheet.getRow(currentRow)
        headerRow.font = { bold: true, size: 20 }
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } }

        let minimumRow = currentRow + Math.ceil(scaledImgHeight / heightUnit / 1.25)

        copyList[i].slice(1).forEach((copyItem, index) => {
            copys.push(
                hasCopyRevision
                    ? [, index + 1, copyItem.key, copyItem.text, copyItem.text]
                    : [, index + 1, copyItem.key, copyItem.text]
            )
            minimumRow -= getRowCount(copyItem.text, columnWidth) - 1
        })

        let targetRow = minimumRow > currentRow + copys.length ? minimumRow : currentRow + copys.length
        const additonalRows =
            targetRow - currentRow - copys.length - 2 > 0 ? targetRow - currentRow - copys.length - 2 : 0
        targetRow = additonalRows === 0 ? targetRow + 1 : targetRow

        copys = copys.concat(new Array(additonalRows).fill(hasCopyRevision ? [, "", "", "", ""] : [, "", "", ""]))
        const coloumns = [
            { name: `${i + 1}. ${screenName}` },
            { name: "Id" },
            { name: "Key" },
            { name: currentCopyTitle },
        ]
        worksheet.addTable({
            name: tableName,
            ref: "A" + currentRow,
            headerRow: true,
            columns: hasCopyRevision ? [...coloumns, { name: "Copy Revision" }] : [...coloumns],
            rows: [...copys],
        })

        const image = workbook.addImage({
            base64: imgItem.img,
            extension: "jpeg",
        })
        worksheet.addImage(image, {
            tl: { col: 0, row: currentRow },
            ext: { width: scaledImgWidth, height: scaledImgHeight },
        })

        imgCol.eachCell((cell) => (cell.name = "Print_Area"))
        indexCol.eachCell((cell) => (cell.name = "Print_Area"))
        keyCol.eachCell((cell) => (cell.name = "Print_Area"))
        copyCol.eachCell((cell) => (cell.name = "Print_Area"))
        if (hasCopyRevision) revisionCol.eachCell((cell) => (cell.name = "Print_Area"))

        currentRow = targetRow + 1
    })

    addFormattingForCopyRevision(worksheet, "$E:$E", "$E1<>$D1")

    imgCol.border = imgBolder
    indexCol.alignment = copyAlignment
    keyCol.alignment = copyAlignment
    copyCol.alignment = copyAlignment
    if (hasCopyRevision) revisionCol.alignment = copyAlignment
}

const readExcel = (path) => {
    try {
        const data = fs.readFileSync(path)
        return data
    } catch (error) {
        return undefined
    }
}

const saveAsExcel = async (ExcelFilePath) => {
    const date = new Date()
    const sheetName = `${date.getFullYear()}-${
        date.getMonth() + 1
    }-${date.getDate()} (${date.getHours()}-${date.getMinutes()}-${date.getSeconds()})`
    let workbook = new ExcelJS.Workbook()
    let isNew = true

    const data = readExcel(ExcelFilePath)
    if (data) await workbook.xlsx.load(data)
    if (workbook.creator === creator) {
        isNew = false
    } else workbook = new ExcelJS.Workbook()

    workbook.modified = date
    workbook.creator = creator

    const worksheet = workbook.addWorksheet(sheetName)

    if (!isNew) {
        workbook.worksheets[0].tables = {}
        workbook.definedNames.getMatrix("Print_Area").sheets = {}
        workbook.eachSheet((sheet) => (sheet.orderNo = sheet === worksheet ? 0 : sheet.orderNo + 1))
    }

    if (isHorizontal) {
        generateHorizontalSheet(workbook, worksheet, sheetName)
    } else generateVerticalSheet(workbook, worksheet, sheetName)

    const buf = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(ExcelFilePath, buf)
    UI.message("🚀 Successfully Exported")
}

const getImgFromLayer = (layer) => {
    const imgBuffer = sketch.export(layer, { formats: "jpg", output: false })
    const base64Img = "data:image/jpeg;base64," + imgBuffer.toString("base64")
    return base64Img
}

const exportCopyByNamePrefix = (layer) => {
    return layer.name.indexOf("@@") === 0
}

const exportCopyByExportState = (layer) => {
    if (layer.exportFormats.length > 0) {
        let exportable = false
        layer.exportFormats.forEach((slice) => {
            if (slice.prefix === "copy" || slice.suffix === "copy") exportable = true
        })
        return exportable
    } else false
}

const setCopyExportState = (layer, state) => {
    if (state)
        layer.exportFormats.push({
            prefix: "copy",
        })
}

const getTransformedText = (rule, text) => {
    switch (rule) {
        case "uppercase":
            return text.toUpperCase()
        case "lowercase":
            return text.toLowerCases()
        default:
            return text
    }
}

const swapContentInArray = (array, id1, id2) => {
    let tempItem = array[id1]
    array[id1] = array[id2]
    array[id2] = tempItem
}

const sortArtboardTBLR = (artboards) => {
    let sortedArtboards = [...artboards]
    for (let i = 0; i < sortedArtboards.length - 1; i++) {
        for (let j = 0; j < sortedArtboards.length - i - 1; j++) {
            if (sortedArtboards[j].frame.y > sortedArtboards[j + 1].frame.y)
                swapContentInArray(sortedArtboards, j, j + 1)
            else if (
                sortedArtboards[j].frame.y === sortedArtboards[j + 1].frame.y &&
                sortedArtboards[j].frame.x > sortedArtboards[j + 1].frame.x
            )
                swapContentInArray(sortedArtboards, j, j + 1)
        }
    }
    return sortedArtboards
}

const sortCopyTBLR = (copys) => {
    let sortedCopys = [...copys]
    for (let i = 1; i < sortedCopys.length - 1; i++) {
        for (let j = 1; j < sortedCopys.length - i; j++) {
            if (sortedCopys[j].y > sortedCopys[j + 1].y) {
                swapContentInArray(sortedCopys, j, j + 1)
            } else if (sortedCopys[j].y === sortedCopys[j + 1].y && sortedCopys[j].x > sortedCopys[j + 1].x) {
                swapContentInArray(sortedCopys, j, j + 1)
            }
        }
    }
    return sortedCopys
}

const extractCopy = (artboard, i, width, height) => {
    artboard.layers.forEach((layer) => {
        if (
            layer.type !== layerType.TEXT ||
            (exportInViewOnly &&
                (layer.frame.x > width ||
                    layer.frame.y > height ||
                    layer.frame.x + layer.frame.width < 0 ||
                    layer.frame.y + layer.frame.height < 0)) ||
            (exportSliceOnly && !exportCopyByExportState(layer)) ||
            (exportAtCopyOnly && !exportCopyByNamePrefix(layer))
        )
            return

        copyList[i].push({
            key: layer.name.replace("@@", "").split("@@").reverse().join("/"),
            x: layer.frame.x,
            y: layer.frame.y,
            text: getTransformedText(layer.style.textTransform, layer.text),
        })
    })
}

const flattenGroup = (group) => {
    let isFlat = true
    do {
        isFlat = true
        group.layers.forEach((layer) => {
            if (layer.hidden) {
                layer.remove()
                return
            }
            switch (layer.type) {
                case layerType.SYMBOLINSTANCE:
                    const symbolGroup = layer.detach({ recursively: false })
                    if (symbolGroup === null) {
                        layer.remove()
                    } else {
                        if (exportSliceOnly && exportCopyByExportState(layer))
                            symbolGroup.layers.forEach((sublayer) => setCopyExportState(sublayer, true))
                        if (exportAtCopyOnly && !exportCopyByNamePrefix(layer)) symbolGroup.remove()
                        symbolGroup.layers.forEach((sublayer) => (sublayer.name += symbolGroup.name))
                        symbolGroup.sketchObject.ungroup()
                        isFlat = false
                    }
                    break
                case layerType.GROUP:
                    if (exportSliceOnly && exportCopyByExportState(layer))
                        layer.layers.forEach((sublayer) => setCopyExportState(sublayer, true))
                    layer.sketchObject.ungroup()
                    isFlat = false
                    break
                case layerType.TEXT:
                    if (exportAtCopyOnly && !exportCopyByNamePrefix(layer)) layer.remove()
                    break
                default:
                    layer.remove()
            }
        })
    } while (!isFlat)
}

const createIndexMarker = (page) => {
    const artboard = new sketch.Artboard({ name: indexMarkerName })
    const size = 24
    artboard.parent = page
    artboard.frame.width = size
    artboard.frame.height = size

    const circle = sketch.ShapePath.fromSVGPath(
        "M12,24 C18.627417,24 24,18.627417 24,12 C24,5.372583 18.627417,0 12,0 C5.372583,0 0,5.372583 0,12 C0,18.627417 5.372583,24 12,24 Z"
    )
    circle.parent = artboard
    circle.style.fills = [
        {
            color: "#ff0000",
            fillType: sketch.Style.FillType.Color,
        },
    ]

    const index = new sketch.Text({
        text: "0",
        style: {
            alignment: sketch.Text.Alignment.center,
            verticalAlignment: sketch.Text.VerticalAlignment.center,
            fontSize: 16,
            lineHeight: size,
            textColor: "#ffffff",
            borders: [],
        },
        parent: artboard,
    })
    index.frame.x = 0
    index.frame.y = 0
    index.frame.width = size
    index.frame.height = size

    return sketch.SymbolMaster.fromArtboard(artboard)
}

const createCloneWithBorder = (page, sourceArtboard, marker) => {
    const tempArtboard = new sketch.Artboard()
    tempArtboard.frame.width = sourceArtboard.frame.width + marker.frame.width * 2
    tempArtboard.frame.height = sourceArtboard.frame.height + marker.frame.height * 2
    tempArtboard.parent = page

    const imgShape = new sketch.Shape()
    imgShape.frame.x = marker.frame.width
    imgShape.frame.y = marker.frame.width
    imgShape.frame.width = sourceArtboard.frame.width
    imgShape.frame.height = sourceArtboard.frame.height
    imgShape.parent = tempArtboard

    const buffer = sketch.export(sourceArtboard, { scales: 3, formats: "png", output: false })
    const imgContent = sketch.createLayerFromData(buffer, "bitmap")

    imgShape.style.fills = [
        {
            pattern: {
                patternType: sketch.Style.PatternFillType.Fit,
                image: imgContent.image,
            },
            fillType: sketch.Style.FillType.pattern,
        },
    ]
    return tempArtboard
}

export const generateExcel = async () => {
    if (selectedLayers.isEmpty) {
        sketch.UI.message("❌ Please select at least 1 artboard.")
        return
    }

    const selectedArtboards = sortArtboardTBLR(selectedLayers.layers)

    const ExcelFilePath = dialog.showSaveDialogSync(doc, { filters: [{ extensions: ["xlsx"] }] })

    if (ExcelFilePath) {
        UI.getInputFromUser(
            "What's the image scale do you want to export?",
            {
                initialValue: "1x",
                type: UI.INPUT_TYPE.selection,
                possibleValues: ["0.25x", "0.5x", "0.75x", "1x"],
                description: "Depends on the amount of text, it may take a few seconds...",
            },
            (err, value) => {
                if (err) return

                scale = 1 / parseFloat(value)
                const symbolPage = sketch.Page.getSymbolsPage(doc) || sketch.Page.createSymbolsPage()
                symbolPage.parent = doc
                const indexMarkerList = sketch.find(
                    `${layerType.SYMBOLMASTER}, [name="${indexMarkerName}"]`,
                    symbolPage
                )
                const indexMarkerMaster =
                    indexMarkerList.length > 0 ? indexMarkerList[0] : createIndexMarker(sketch.Page.getSymbolsPage(doc))
                const tempPage = new sketch.Page({ name: "temp" })
                tempPage.parent = doc

                selectedArtboards.forEach((artboard) => {
                    if (artboard.type === layerType.ARTBOARD) {
                        copyList.push([{ key: "Name", text: artboard.name }])

                        const tempArtboardCopy = artboard.duplicate()
                        flattenGroup(tempArtboardCopy)
                        extractCopy(tempArtboardCopy, copyList.length - 1, artboard.frame.width, artboard.frame.height)
                        copyList[copyList.length - 1] = sortCopyTBLR(copyList[copyList.length - 1])

                        const tempArtboardIndex = createCloneWithBorder(tempPage, artboard, indexMarkerMaster)

                        if (indexMarkerMaster !== null) {
                            copyList[copyList.length - 1].forEach((copyInfo, index) => {
                                if (index === 0) return
                                const marker = indexMarkerMaster.createNewInstance()
                                marker.parent = tempArtboardIndex
                                marker.overrides.forEach((override) => {
                                    if (override.property == "stringValue") override.value = index
                                })
                                marker.frame.x = copyInfo.x + marker.frame.width / 4
                                marker.frame.y = copyInfo.y + marker.frame.height / 4
                            })
                        }

                        base64ImgList.push({
                            img: getImgFromLayer(tempArtboardIndex),
                            width: tempArtboardIndex.frame.width,
                            ratio: tempArtboardIndex.frame.height / tempArtboardIndex.frame.width,
                        })

                        tempArtboardCopy.remove()
                        tempArtboardIndex.remove()
                    }
                })
                tempPage.remove()
                if (base64ImgList.length > 0) saveAsExcel(ExcelFilePath)
            }
        )
    }
}
