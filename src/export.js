import dialog from "@skpm/dialog"
const fs = require("@skpm/fs")
const sketch = require("sketch")
const ExcelJS = require("exceljs")
const Settings = sketch.Settings
const doc = sketch.getSelectedDocument()
const selectedLayers = doc.selectedLayers

let base64ImgList = []
let copyList = []

const layerType = {
    PAGE: "Page",
    ARTBOARD: "Artboard",
    SHAPEPATH: "ShapePath",
    TEXT: "Text",
    SYMBOLINSTANCE: "SymbolInstance",
    SYMBOLMASTER: "SymbolMaster",
}

const prefernceKey = {
    KEY: "lzhengCopyUpdaterKey",
    JSON_PATH: "lzhengCopyUPdaterJSONPath",
    EXPORT_ORIENTATION: "exportOrientation",
    EXPORT_SLICE_ONLY: "exportSliceOnly",
    HAS_COPY_REVISION: "hasCopyRevision",
    EXPORT_INVIEW_ONLY: "exportInViewOnly",
}
const charNewLine = String.fromCharCode(10)
const exportSliceOnly = Settings.settingForKey(prefernceKey.EXPORT_SLICE_ONLY)
const isHorizontal = Settings.settingForKey(prefernceKey.EXPORT_ORIENTATION) === 0
const hasCopyRevision = Settings.settingForKey(prefernceKey.HAS_COPY_REVISION)
const exportInViewOnly = Settings.settingForKey(prefernceKey.EXPORT_INVIEW_ONLY)

const imgBolder = {
    bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
    left: { style: "thin", color: { argb: "FFFFFFFF" } },
    right: { style: "think", color: { argb: "FFFFFFFF" } },
}
const copyAlignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 2 }

const addNote = (copyItem, copyCell) => {
    if (copyItem.key) {
        const pathList = copyItem.path ? copyItem.path.split("/") : undefined

        if (pathList) {
            copyCell.note = {
                texts: [
                    { font: { size: 12 }, text: "Source File: " },
                    { font: { size: 12 }, text: pathList[pathList.length - 1] },
                    { font: { size: 14 }, text: charNewLine },
                    { font: { size: 14 }, text: charNewLine },
                    { font: { size: 14, underline: "single", bold: true }, text: copyItem.key },
                ],
            }
        } else {
            copyCell.note = {
                texts: [
                    { font: { size: 12 }, text: "Source not found" },
                    { font: { size: 14 }, text: charNewLine },
                    { font: { size: 14 }, text: charNewLine },
                    { font: { size: 14, underline: "single", bold: true }, text: copyItem.key },
                ],
            }
        }
        copyCell.note.margins = { insetmode: "custom", inset: [0.125, 0.5, 0.125, 0.5] }
    }
}

const generateHorizontalSheet = (workbook, worksheet) => {
    const scale = 1.125
    const rowHeight = 40

    worksheet.properties.defaultRowHeight = rowHeight
    worksheet.views = [{ state: "frozen", ySplit: 1 }]
    worksheet.pageSetup = { fitToWidth: base64ImgList.length }

    const headerRow = worksheet.getRow(1)
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } }

    base64ImgList.forEach((imgItem, i) => {
        const scaledImgWidth = imgItem.width / scale

        const imgCol = worksheet.getColumn(i * 3 + 1)
        const copyCol = worksheet.getColumn(i * 3 + 2)
        const dividerCol = worksheet.getColumn(i * 3 + 3)

        worksheet.mergeCells(1, i * 3 + 1, 1, i * 3 + 2)
        copyList[i].forEach((copyItem, j) => {
            const copyCell = worksheet.getCell(j + 1, i * 3 + 2)
            worksheet.getRow(j + 1).height = rowHeight
            copyCell.value = copyItem.text
            addNote(copyItem, copyCell)
        })

        imgCol.width = scaledImgWidth / 8
        copyCol.width = 60
        dividerCol.width = 4
        copyCol.font = { size: 14 }
        copyCol.alignment = copyAlignment
        dividerCol.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF999999" } }
        imgCol.border = imgBolder
        copyCol.border = {
            right: { style: "think", color: { argb: "FFFFFFFF" } },
        }

        const scaledImgHeight = scaledImgWidth * imgItem.ratio

        const image = workbook.addImage({
            base64: imgItem.img,
            extension: "jpeg",
        })
        worksheet.addImage(image, {
            tl: { col: i * 3, row: 1 },
            br: { col: i * 3 + 1, row: scaledImgHeight / rowHeight / 1.25 },
            // ext: { width: scaledImgWidth, height: scaledImgHeight },
        })
    })

    headerRow.font = { bold: true, size: 20 }
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

const generateVerticalSheet = (workbook, worksheet) => {
    const scale = 1.125
    const scaledImgWidth = base64ImgList[0].width / scale
    const columnWidth = 80
    const heightUnit = 20
    const imgCol = worksheet.getColumn(1)
    const copyCol = worksheet.getColumn(2)
    const revisionCol = worksheet.getColumn(3)
    let currentRow = 1

    worksheet.pageSetup = {
        orientation: "landscape",
        scale: Math.floor((columnWidth * 2.5 * 57) / (scaledImgWidth / 8 + columnWidth * 2)),
    }

    copyCol.width = columnWidth
    copyCol.font = { size: 14 }
    imgCol.width = scaledImgWidth / 8
    if (hasCopyRevision) {
        revisionCol.width = columnWidth
        revisionCol.font = { size: 14, color: { argb: "FFBBBBBB" } }
    }

    base64ImgList.forEach((imgItem, i) => {
        const scaledImgHeight = scaledImgWidth * imgItem.ratio
        const minimumRowSteps = Math.ceil(scaledImgHeight / heightUnit / 1.25) + 1
        const headerRow = worksheet.getRow(currentRow)
        headerRow.font = { bold: true, size: 20 }
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } }

        worksheet.mergeCells(currentRow, 1, currentRow, 2)

        const image = workbook.addImage({
            base64: imgItem.img,
            extension: "jpeg",
        })
        worksheet.addImage(image, {
            tl: { col: 0, row: currentRow },
            ext: { width: scaledImgWidth, height: scaledImgHeight },
        })

        let minimumRow = currentRow + minimumRowSteps

        copyList[i].forEach((copyItem, j) => {
            const copyCell = worksheet.getCell(currentRow, 2)
            const revisionCell = worksheet.getCell(currentRow, 3)
            copyCell.value = copyItem.text
            revisionCell.value = hasCopyRevision ? (j == 0 ? "Copy Revision" : copyItem.text) : ""
            minimumRow -= getRowCount(copyItem.text, columnWidth) - 1
            addNote(copyItem, copyCell)
            currentRow++
        })

        currentRow = minimumRow > currentRow ? minimumRow : currentRow
        worksheet.getRow(currentRow).addPageBreak()
        currentRow++
    })

    if (hasCopyRevision) {
        worksheet.addConditionalFormatting({
            ref: "$C:$C",
            rules: [
                {
                    type: "expression",
                    formulae: ["$C1<>$B1"],
                    style: { font: { color: { argb: "FFFF3333" }, bold: true } },
                },
                {
                    type: "expression",
                    formulae: ["$C1<>$B1"],
                    style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFCCCC" } } },
                },
            ],
        })
    }

    copyCol.alignment = copyAlignment
    revisionCol.alignment = copyAlignment
    imgCol.border = imgBolder
}

const saveAsExcel = async (ExcelFilePath) => {
    const date = new Date()
    const sheetName = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-")
    const workbook = new ExcelJS.Workbook()
    workbook.created = date
    workbook.creator = "Sketch Plugin: Copy Updater"

    const worksheet = workbook.addWorksheet(sheetName)

    if (isHorizontal) {
        generateHorizontalSheet(workbook, worksheet)
    } else generateVerticalSheet(workbook, worksheet)

    const buf = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(ExcelFilePath, buf)
}

const getImgFromLayer = (layer) => {
    const imgBuffer = sketch.export(layer, { formats: "jpg", output: false })
    const base64Img = "data:image/jpeg;base64," + imgBuffer.toString("base64")
    return base64Img
}

const getCopyExportState = (layer) => {
    if (layer.exportFormats.length > 0) {
        let exportable = false
        layer.exportFormats.forEach((slice) => {
            if (slice.prefix === "copy" || slice.suffix === "copy") exportable = true
        })
        return exportable
    } else false
}

const extractText = (layer, i, exportable, x, y, width, height) => {
    if (layer.layers === undefined) {
        if (layer.hidden) return
        if (!exportable && exportSliceOnly) {
            if (!getCopyExportState(layer)) return
        }
        if (exportInViewOnly && (x > width || y > height)) return
        const storedKey = Settings.layerSettingForKey(layer, prefernceKey.KEY)
        const JSONPath = Settings.layerSettingForKey(layer, prefernceKey.JSON_PATH)
        switch (layer.type) {
            case layerType.TEXT:
                copyList[i].push({
                    path: JSONPath ? JSONPath : null,
                    key: storedKey ? storedKey[0] : null,
                    text: layer.text,
                })
                break
            case layerType.SYMBOLINSTANCE:
                layer.overrides.forEach((override, j) => {
                    if (override.property === "stringValue")
                        copyList[i].push({
                            path: JSONPath ? JSONPath : null,
                            key: storedKey ? storedKey[j] : null,
                            text: override.value,
                        })
                })
                break
        }
    } else
        layer.layers.forEach((sublayer) => {
            if (!sublayer.hidden)
                extractText(
                    sublayer,
                    i,
                    exportable || getCopyExportState(sublayer),
                    x + sublayer.frame.x,
                    y + sublayer.frame.y,
                    width,
                    height
                )
        })
}

export const generateExcel = () => {
    if (selectedLayers.isEmpty) {
        sketch.UI.message("❌ Please select at least 1 artboard.")
        return
    }

    const ExcelFilePath = dialog.showSaveDialogSync(doc, { filters: [{ extensions: ["xlsx"] }] })

    if (ExcelFilePath) {
        selectedLayers.forEach((layer) => {
            if (layer.type === layerType.ARTBOARD) {
                base64ImgList.push({
                    img: getImgFromLayer(layer),
                    width: layer.frame.width,
                    ratio: layer.frame.height / layer.frame.width,
                })
                copyList.push([{ key: "Name", text: layer.name }])
                extractText(
                    layer,
                    copyList.length - 1,
                    exportSliceOnly ? getCopyExportState(layer) : true,
                    0,
                    0,
                    layer.frame.width,
                    layer.frame.height
                )
            }
        })
        saveAsExcel(ExcelFilePath)
    }
}
