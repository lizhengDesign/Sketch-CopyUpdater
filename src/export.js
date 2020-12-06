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
}

const saveAsExcel = async (ExcelFilePath) => {
    const date = new Date()
    const sheetName = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-")
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ state: "frozen", ySplit: 1 }],
    })

    const scale = 1.125
    const rowHeight = 40

    worksheet.properties.defaultRowHeight = rowHeight

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

            if (copyItem.key) {
                const pathList = copyItem.path ? copyItem.path.split("/") : undefined

                if (pathList) {
                    copyCell.note = {
                        texts: [
                            { font: { size: 12 }, text: "Designer: " },
                            { font: { size: 12 }, text: pathList[2] },
                            { font: { size: 14 }, text: String.fromCharCode(10) },
                            { font: { size: 14 }, text: String.fromCharCode(10) },
                            { font: { size: 12 }, text: "Source File: " },
                            { font: { size: 12 }, text: pathList[pathList.length - 1] },
                            { font: { size: 14 }, text: String.fromCharCode(10) },
                            { font: { size: 14 }, text: String.fromCharCode(10) },
                            { font: { size: 14, underline: "single", bold: true }, text: copyItem.key },
                        ],
                    }
                } else {
                    copyCell.note = {
                        texts: [
                            {
                                font: { size: 12 },
                                text: "Source not found",
                            },
                            { font: { size: 14 }, text: String.fromCharCode(10) },
                            { font: { size: 14 }, text: String.fromCharCode(10) },
                            { font: { size: 14, underline: "single", bold: true }, text: copyItem.key },
                        ],
                    }
                }
                copyCell.note.margins = { insetmode: "custom", inset: [0.125, 0.725, 0.125, 0.725] }
            }
        })

        imgCol.width = scaledImgWidth / 8
        copyCol.width = 60
        dividerCol.width = 4
        copyCol.font = { size: 16 }
        copyCol.alignment = { horizontal: "left", vertical: "middle", shrinkToFit: true, wrapText: true, indent: 2 }
        dividerCol.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF999999" } }
        imgCol.border = {
            bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
            left: { style: "thin", color: { argb: "FFFFFFFF" } },
            right: { style: "think", color: { argb: "FFFFFFFF" } },
        }
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
            ext: { width: scaledImgWidth, height: scaledImgHeight },
        })
    })

    headerRow.font = { bold: true, size: 20 }

    const buf = await workbook.xlsx.writeBuffer()

    fs.writeFileSync(ExcelFilePath, buf)
}

const getImgFromLayer = (layer) => {
    const imgBuffer = sketch.export(layer, { formats: "jpg", output: false })
    const base64Img = "data:image/jpeg;base64," + imgBuffer.toString("base64")
    return base64Img
}

const exportContent = (layer, i) => {
    if (layer.layers == undefined) {
        const storedKey = Settings.layerSettingForKey(layer, prefernceKey.KEY)
        const JSONPath = Settings.layerSettingForKey(layer, prefernceKey.JSON_PATH)
        switch (layer.type) {
            case layerType.TEXT:
                copyList[i].push({
                    path: JSONPath ? JSONPath : undefined,
                    key: storedKey ? storedKey[0] : undefined,
                    text: layer.text,
                })
                break
            case layerType.SYMBOLINSTANCE:
                layer.overrides.forEach((override, j) => {
                    if (override.property == "stringValue")
                        copyList[i].push({
                            path: JSONPath ? JSONPath : undefined,
                            key: storedKey ? storedKey[j] : undefined,
                            text: override.value,
                        })
                })
                break
        }
    } else layer.layers.forEach((sublayer) => exportContent(sublayer, i))
}

export const generateExcel = () => {
    if (selectedLayers.isEmpty) {
        sketch.UI.message("❌ Please select at least 1 artboard.")
        return
    }

    const ExcelFilePath = dialog.showSaveDialogSync(doc, { filters: [{ name: "Excel", extensions: ["xlsx"] }] })

    if (ExcelFilePath) {
        selectedLayers.forEach((layer, i) => {
            if (layer.type == layerType.ARTBOARD) {
                base64ImgList.push({
                    img: getImgFromLayer(layer),
                    width: layer.frame.width,
                    ratio: layer.frame.height / layer.frame.width,
                })
                copyList[i] = [
                    {
                        key: "Name",
                        text: layer.name,
                    },
                ]
                exportContent(layer, i)
            }
        })
        saveAsExcel(ExcelFilePath)
    }
}
