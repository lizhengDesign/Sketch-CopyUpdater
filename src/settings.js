const sketch = require("sketch")
const Settings = sketch.Settings
const UI = sketch.UI
const responseOptions = {
    SAVE: 1000,
    CANCEL: 1002,
}
const prefernceKey = {
    IS_CHECK: "isCheckOnOpenDocument",
    HAS_DOCUMENTATION: "hasCopyDocumentation",
    CHECK_SCOPE: "copyCheckScope",
    HAS_EDITABLE_ONLY_SELECTED: "hasExportEditableOnlySelected",
    EXPORT_ORIENTATION: "exportOrientation",
    EXPORT_SLICE_ONLY: "exportSliceOnly",
    EXPORT_AT_COPY_ONLY: "exportAtCopyOnly",
    EXPORT_INVIEW_ONLY: "exportInViewOnly",
    HAS_COPY_REVISION: "hasCopyRevision",
    HAS_COPY_INDEX: "hasCopyIndex",
    HAS_COPY_KEY: "hasCopyKey",
    HAS_JSON_KEY: "hasJSONKey",
}
const panelSpec = {
    width: 300,
    height: 395,
    lineHeight: 25,
}
const checkScopeOptions = ["Selected page", 'Pages starting with "@"', "Entire document"]
const exportOrientationOptions = ["Layout orientation: Horizontal", "Layout orientation: Vertical"]
let UIComponentRect = (y) => NSMakeRect(0, panelSpec.height - y, panelSpec.width, panelSpec.lineHeight)
let checkCopyToggle,
    copyDocumentationToggle,
    exportAllStringsToggle,
    exportSliceOnlyToggle,
    exportAtCopyOnlyToggle,
    exportInViewOnlyToggle,
    copyRevisionToggle,
    copyIndexToggle,
    copyKeyToggle,
    jsonKeyToggle,
    checkScopeDropdown,
    exportOrientationDropdown

const createLabel = (positionY, text) => {
    const label = NSTextField.alloc().initWithFrame(UIComponentRect(positionY))

    label.setStringValue(text)
    label.setSelectable(false)
    label.setEditable(false)
    label.setBezeled(false)
    label.setDrawsBackground(false)

    return label
}

const createToggle = (positionY, settingKey, text) => {
    const toggle = NSButton.alloc().initWithFrame(UIComponentRect(positionY))
    const initValue = Settings.settingForKey(settingKey) === 1 ? NSOnState : NSOffState

    toggle.setButtonType(NSSwitchButton)
    toggle.setBezelStyle(0)
    toggle.setTitle(text)
    toggle.setState(initValue)

    return toggle
}

const createDropdown = (positionY, possibleValue, initValue) => {
    const dropdowm = NSPopUpButton.alloc().initWithFrame(UIComponentRect(positionY))
    const initialIndex = possibleValue.indexOf(initValue)

    dropdowm.addItemsWithTitles(possibleValue)
    dropdowm.selectItemAtIndex(initialIndex !== -1 ? initialIndex : 0)

    return dropdowm
}

export const createSettingPanel = () => {
    var panel = COSAlertWindow.new()
    panel.setIcon(__command.pluginBundle().alertIcon())
    panel.setMessageText("Copy Updater Settings")
    panel.addButtonWithTitle("Save")
    panel.addButtonWithTitle("Cancel")
    const view = NSView.alloc().initWithFrame(NSMakeRect(0, 0, panelSpec.width, panelSpec.height))
    panel.addAccessoryView(view)

    let y = 0

    // -------------------------------------------------
    //  Check Scope
    // -------------------------------------------------
    y += 30
    let checkScopeLabel = createLabel(y, "Copy check scope:")
    y += 20
    checkScopeDropdown = createDropdown(
        y,
        checkScopeOptions,
        checkScopeOptions[Settings.settingForKey(prefernceKey.CHECK_SCOPE)]
    )

    // -------------------------------------------------
    //  Excel
    // -------------------------------------------------
    y += 50
    let exportOrientationLabel = createLabel(y, "Excel settings:")
    y += 20
    exportOrientationDropdown = createDropdown(
        y,
        exportOrientationOptions,
        exportOrientationOptions[Settings.settingForKey(prefernceKey.EXPORT_ORIENTATION)]
    )
    y += 25
    exportSliceOnlyToggle = createToggle(
        y,
        prefernceKey.EXPORT_SLICE_ONLY,
        "Export slices with 'copy' as Prefix or Suffix"
    )
    y += 20
    exportAtCopyOnlyToggle = createToggle(y, prefernceKey.EXPORT_AT_COPY_ONLY, "Export layers with '@@' as name prefix")
    y += 20
    exportInViewOnlyToggle = createToggle(y, prefernceKey.EXPORT_INVIEW_ONLY, "Ignore content outside of artboards")
    y += 20
    copyIndexToggle = createToggle(y, prefernceKey.HAS_COPY_INDEX, "Add markers on the screen and an index column")
    y += 20
    copyKeyToggle = createToggle(y, prefernceKey.HAS_COPY_KEY, "Add a layer name column")
    y += 20
    jsonKeyToggle = createToggle(y, prefernceKey.HAS_JSON_KEY, "Add a JSON key column")
    y += 20
    copyRevisionToggle = createToggle(y, prefernceKey.HAS_COPY_REVISION, "Add a copy revision column")

    // -------------------------------------------------
    //  Other
    // -------------------------------------------------
    y += 50
    let otherLabel = createLabel(y, "Other settings:")
    y += 20
    checkCopyToggle = createToggle(y, prefernceKey.IS_CHECK, "Check copy when open a Sketch document")
    y += 20
    exportAllStringsToggle = createToggle(
        y,
        prefernceKey.HAS_EDITABLE_ONLY_SELECTED,
        "Only export editable text to JSON"
    )
    y += 20
    copyDocumentationToggle = createToggle(y, prefernceKey.HAS_DOCUMENTATION, "Maintain a copy index page")

    view.addSubview(checkScopeLabel)
    view.addSubview(checkScopeDropdown)

    view.addSubview(exportSliceOnlyToggle)
    view.addSubview(exportAtCopyOnlyToggle)
    view.addSubview(exportInViewOnlyToggle)
    view.addSubview(copyIndexToggle)
    view.addSubview(jsonKeyToggle)
    view.addSubview(copyKeyToggle)
    view.addSubview(copyRevisionToggle)
    view.addSubview(exportOrientationLabel)
    view.addSubview(exportOrientationDropdown)

    view.addSubview(otherLabel)
    view.addSubview(checkCopyToggle)
    view.addSubview(copyDocumentationToggle)
    view.addSubview(exportAllStringsToggle)

    return panel.runModal()
}

export const updateSettings = () => {
    const checkScope = checkScopeDropdown.indexOfSelectedItem()
    const orientation = exportOrientationDropdown.indexOfSelectedItem()
    Settings.setSettingForKey(prefernceKey.CHECK_SCOPE, checkScope)
    Settings.setSettingForKey(prefernceKey.EXPORT_SLICE_ONLY, exportSliceOnlyToggle.state())
    Settings.setSettingForKey(prefernceKey.EXPORT_AT_COPY_ONLY, exportAtCopyOnlyToggle.state())
    Settings.setSettingForKey(prefernceKey.EXPORT_INVIEW_ONLY, exportInViewOnlyToggle.state())
    Settings.setSettingForKey(prefernceKey.HAS_COPY_INDEX, copyIndexToggle.state())
    Settings.setSettingForKey(prefernceKey.HAS_JSON_KEY, jsonKeyToggle.state())
    Settings.setSettingForKey(prefernceKey.HAS_COPY_KEY, copyKeyToggle.state())
    Settings.setSettingForKey(prefernceKey.HAS_COPY_REVISION, copyRevisionToggle.state())
    Settings.setSettingForKey(prefernceKey.EXPORT_ORIENTATION, orientation)
    Settings.setSettingForKey(prefernceKey.IS_CHECK, checkCopyToggle.state())
    Settings.setSettingForKey(prefernceKey.HAS_EDITABLE_ONLY_SELECTED, exportAllStringsToggle.state())
    Settings.setSettingForKey(prefernceKey.HAS_DOCUMENTATION, copyDocumentationToggle.state())

    UI.message(`✅ Successfully updated`)
}

export default () => {
    let response = createSettingPanel()
    switch (response) {
        case responseOptions.SAVE:
            updateSettings()
            break
        case responseOptions.CANCEL:
            break
    }
}
