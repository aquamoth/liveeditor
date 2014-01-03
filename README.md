liveeditor
==========

jQuery plugin that displays input editors when the user hovers over an editable control.

The minified version is compressed with UglifyJS using http://jscompress.com/

	0.7.0 - Added function $.liveeditor.isEnabled() to test if a certain field is enabled or disabled.
			Also fixed incompatibilities with jQuery 1.10.2. Previous version was just tested on jQuery 1.7.1
	0.6.1 - $.liveeditor.reset() no longer calls onChanged(). It was a bad design decision that caused more problems than it solved.
    0.6.0 - Editor now cancels changes when hovering and leaving an editor or pressing ESC key, 
               rather than committing the old value. Important for comboboxes with missing values for example.
            Also added method $.liveeditor.serializeRow() for improved serialization of the special case of datagrids.
            Fixed minor bugfixes.
    0.5.0 - Fixed bug when calling event onSetValue. 
            Also fixed bug when committing editors the plugin could mistake inner html for being an editor and crash.
    0.4.0 - Added editingCss option for improved skinning.
    0.3.0 - get() and serialize() public functions added for simple value retrieval by the page logic.
    0.2.0 - set() and reset() functions operates on selectors instead of single elements.
            Fixed major bug in reset().
    0.1.0 - Initial release.
