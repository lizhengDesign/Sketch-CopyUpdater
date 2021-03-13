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
}
const panelSpec = {
    width: 300,
    height: 335,
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

    let checkScopeLabel = createLabel(30, "Copy check scope:")
    checkScopeDropdown = createDropdown(
        50,
        checkScopeOptions,
        checkScopeOptions[Settings.settingForKey(prefernceKey.CHECK_SCOPE)]
    )

    let exportOrientationLabel = createLabel(100, "Excel settings:")
    exportOrientationDropdown = createDropdown(
        120,
        exportOrientationOptions,
        exportOrientationOptions[Settings.settingForKey(prefernceKey.EXPORT_ORIENTATION)]
    )
    exportSliceOnlyToggle = createToggle(
        145,
        prefernceKey.EXPORT_SLICE_ONLY,
        "Only export slices with 'copy' as Prefix or Suffix"
    )
    exportAtCopyOnlyToggle = createToggle(
        165,
        prefernceKey.EXPORT_AT_COPY_ONLY,
        "Only export layers with '@@' as name prefix"
    )
    exportInViewOnlyToggle = createToggle(
        185,
        prefernceKey.EXPORT_INVIEW_ONLY,
        "Only export content appearing in the artboards"
    )
    copyRevisionToggle = createToggle(205, prefernceKey.HAS_COPY_REVISION, "Add a copy revision column")

    let otherLabel = createLabel(255, "Other settings:")
    checkCopyToggle = createToggle(275, prefernceKey.IS_CHECK, "Check copy when open a Sketch document")
    exportAllStringsToggle = createToggle(
        295,
        prefernceKey.HAS_EDITABLE_ONLY_SELECTED,
        "Only export editable text to JSON"
    )
    copyDocumentationToggle = createToggle(315, prefernceKey.HAS_DOCUMENTATION, "Maintain a copy index page")

    view.addSubview(checkScopeLabel)
    view.addSubview(checkScopeDropdown)

    view.addSubview(exportSliceOnlyToggle)
    view.addSubview(exportAtCopyOnlyToggle)
    view.addSubview(exportInViewOnlyToggle)
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
