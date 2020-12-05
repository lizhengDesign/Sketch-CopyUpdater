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

const saveAsExcel = async (ExcelFilePath) => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet()

    const imgWidth = 320
    const rowHeight = 40

    worksheet.properties.defaultRowHeight = rowHeight

    const headerRow = worksheet.getRow(1)
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } }

    base64ImgList.forEach((imgItem, i) => {
        const imgCol = worksheet.getColumn(i * 3 + 1)
        const copyCol = worksheet.getColumn(i * 3 + 2)
        const dividerCol = worksheet.getColumn(i * 3 + 3)

        worksheet.mergeCells(1, i * 3 + 1, 1, i * 3 + 2)
        imgCol.width = 40
        copyCol.width = 60
        dividerCol.width = 4
        copyCol.values = copyList[i]
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

        const imgHeight = imgWidth * imgItem.ratio

        const image = workbook.addImage({
            base64: imgItem.img,
            extension: "jpeg",
        })
        worksheet.addImage(image, {
            tl: { col: i * 3, row: 1 },
            ext: { width: imgWidth, height: imgHeight },
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
        switch (layer.type) {
            case layerType.TEXT:
                copyList[i].push(layer.text)
                break
            case layerType.SYMBOLINSTANCE:
                layer.overrides.forEach((override) => {
                    if (override.property == "stringValue") copyList[i].push(override.value)
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
                    ratio: layer.frame.height / layer.frame.width,
                })
                copyList[i] = [layer.name]
                exportContent(layer, i)
            }
        })
        saveAsExcel(ExcelFilePath)
    }
}
