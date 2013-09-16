///
/// LiveEditor jQuery plugin
///
/// $Header: http://svn.didit.se/public/Cosmo/Cosmo.latest/trunk/CosmoWeb/js/liveeditor.js 2004 2013-09-05 13:53:04Z mattias $
///
/// Copyright 2013 Trustfall AB
/// All rights reserved
///
;//Protection against other malformed scripts that can interfere 
(function ($) {

    var defaultOptions = {

        debug: false,

        editor: {
            css: ''
        },

        combobox: {
            css: 'combo'
        },

        checkbox: {
            css: 'checkbox',
            checked: {
                value: 'true',
                html: 'X'
            },
            unchecked: {
                value: 'false',
                html: ''
            }
        },

        ///
        /// Container events
        ///


        onGetValue: null,

        onSetValue: null,
        
        /// Called (after any edit has been closed) when the container has changed its value. Also called by reset().
        onChanged: null,



        /// Called when an editor is being created to allow developers to implement their own editors for certain containers.
        onEditorCreating: null,

        /// Called to get valid options for a combobox Editor.
        /// this event must be overloaded if the comboboxes shall have any options.
        /// Return a string with <option /> elements to display.
        onEditorOptions: function (container) { return '<option value=""></option>'; },

        /// Called after the editor is visible.
        onEditorOpened: null,

        /// Called after the editor receives focus.
        onEditorFocused: null,

        /// Called after the editor has been closed.
        onEditorClosed: null,
    };


    var EDITOR_MARGIN = 5;//TODO: WHY do we need to remove this margin to make the input/select fit its parent container?


    ///
    /// Public LiveEditor Commands
    ///

    $.liveeditor = {
        //version: function () {
        //    return "0.0.1";
        //},

        ///
        /// Enables editing for an unregistered or previously disabled container.
        ///
        enable: function (container) {
            debug("jQuery.liveeditor.enable(container)");
            return enable(container);
        },

        ///
        /// Disables editing for a registered container.
        ///
        disable: function (container) {
            debug("jQuery.liveeditor.disable(container)");
            return disable(container);
        },

        ///
        /// Forces the open editor to save its changes back to its container and close.
        /// Call this method before saving to make sure all changes have been committed.
        ///
        closeEditor: function (container) {
            debug("jQuery.liveeditor.closeEditor(container)");
            //if (container || null === null)
            //    container = $(options.editor._focusedContainer);
            return commitEditor(container);
        },

        ///
        /// Changes the value of a container as if the user had edited it with the editor.
        ///
        set: function (container, value, html) {
            debug("jQuery.liveeditor.set(container, value, html)");
            var originalValue = getContainerValue(container);
            if (container.data('liveeditor-old') === undefined) {
                container.data('liveeditor-old', originalValue);
            }
            if (!updateContainer(container, value, html)) {
                return false;
            }
            if (value !== originalValue) {
                containerChanged(container);
            }
            return true;
        },

        ///
        /// Resets the container to consider its current value the unchanged state.
        /// Call this method for all containers after saving to setup new change-tracking without reloading the entire page.
        ///
        reset: function (container) {
            debug("jQuery.liveeditor.reset(container)");
            container.removeClass('changed');
            container.data('liveeditor-old', undefined);
            containerChanged(container);
            return container;
        }
    };

    ///
    /// Private Event Listeners
    ///

    //Display the editor when the user hovers over the container
    function container_mouseenter() {
        debug("liveeditor.container_mouseenter()");
        displayEditor($(this));
    }

    function container_mouseleave() {
        debug("liveeditor.container_mouseleave()");
        commitEditor(this);//TODO: Should call cancelEditor() instead to make sure the value doesn't change
    }

    //Make the editor "sticky" when focused so it doesn't disappear when the mouse is moved from the container
    function editor_focus() {
        debug('liveeditor.editor_focus()');

        var editor = $(this)
            .unbind('focus', editor_focus)
            .select();
        var container = editor.closest('.liveedit')
            .unbind('mouseleave', container_mouseleave);

        var options = container.data('liveeditor-options');
        if (container[0] === options.editor._focusedContainer) {
            debug('It is the current editing container that got focus. Ignore?!');
            return true; //Since the current containers editor is focused there is no other editor to close
        }

        if (options.editor._focusedContainer) {
            debug('Closing old editing container.');
            debug(options.editor._focusedContainer);
            if (!commitEditor(options.editor._focusedContainer))
                return false;
        }

        debug('Tracking the current editing container.');
        options.editor._focusedContainer = container[0];
        editor.keydown(editor_keydown);
        if ($.isFunction(options.onEditorFocused)) {
            debug("Calling onEditorFocused()");
            options.onEditorFocused.call(container, editor);
        }
        return true;
    }

    //Handle editor TAB and ESC keys
    function editor_keydown(e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode == 27) {       // ESC
            e.preventDefault();
            var container = $(this).closest('.liveedit');
            var options = container.data('liveeditor-options');
            if (!options.editor._focusedContainer) {
                debug("Got ESC keydown for an editor without having a current container. Aborting!");
                return;
            }
            commitEditor(container);//options.editor._focusedContainer
        }
        else if (keyCode == 9) {    //TAB
            e.preventDefault();
            var container = $(this).closest('.liveedit');
            var options = container.data('liveeditor-options');
            if (!options.editor._focusedContainer) {
                debug("Got TAB keydown for an editor without having a current container. Aborting!");
                return;
            }

            //Close the current editor
            var nextContainer = container;//options.editor._focusedContainer; //TODO: Rewrite to use the initialized selector for stepping instead
            commitEditor(container);//options.editor._focusedContainer

            do {
                //Find previous/next editable container
                debug("Selecting next container for editing.");
                if (e.shiftKey) {
                    debug("TAB to prev container");
                    nextContainer = nextContainer.prevAll('.liveedit').eq(0);
                    if (nextContainer.length == 0) {
                        debug("Found no prev container. Moving to parents previous last");
                        nextContainer = $('.liveedit:last', nextContainer.parent().prev());
                    }
                } else {
                    debug("TAB to next container");
                    nextContainer = $("~ .liveedit", nextContainer).eq(0);
                    if (nextContainer.length == 0) {
                        debug("Found no next container. Moving to parents next first");
                        nextContainer = $('.liveedit:first', nextContainer.parent().next());
                    }
                }
                //Open the editor
                if (nextContainer.length > 0) {
                    try {
                        displayEditor(nextContainer).focus();
                        break;
                    } catch (e) {
                        debug("Failed to display editor. Move to the next container.");
                    }
                }
                else {
                    debug("No more containers to test. Not displaying any new editor.");
                    break;
                }
            } while (true);//Iterate through all editing containers until we find one that can be edited now
        }
    }









    ///
    /// Private methods
    ///
    function debug(msg) {
        //if (settings.debug && console)
        //    console.log(msg);
    }
    function enable(container) {
        if (!container.hasClass('liveedit')) {
            container
                .addClass('liveedit')
                .mouseenter(container_mouseenter);
        }
        return container;
    }
    function disable(container) {
        if (container.hasClass('liveedit')) {
            container
                .removeClass('liveedit')
                .unbind('mouseenter', container_mouseenter);
        }
        return container;
    }

    ///
    /// Method called to get the current value of a container before displaying its editor.
    /// Implement the events onGetValue() and onSetValue() if the container does not store its value in LiveEditors default way.
    /// Returns the containers current value as a string.
    ///
    function getContainerValue (container) { 
        var value;
        var options = container.data('liveeditor-options');
        if ($.isFunction(options.onGetValue)) {
            debug('Calling onGetValue()');
            value = options.onGetValue.call(container);
        }
        if (!value) {
            debug('Looking up value from container');
            value = container.hasClass(options.combobox.css) || container.hasClass(options.checkbox.css) 
                ? container.attr('value') 
                : container.text(); 
        }
        debug('getContainerValue() returns: ' + value);
        return value;
    }

    ///
    /// Method called to set the new value of a container. If the container has an open editor it is closed by this commmand.
    /// Implement the events onGetValue() and onSetValue() if the container does not store its value in LiveEditors default way.
    /// Returns true if the value was written successfully and false if the operation was cancelled.
    ///
    function updateContainer(container, newValue, newHtml) {
        debug("liveeditor.updateContainer(container, newValue, newHtml)");
        var success;

        var oldValue = container.data('liveeditor-old');

        //Let the user override the setting of the value to the container if he likes
        var options = container.data('liveeditor-options');
        if ($.isFunction(options.onSetValue)) {
            debug('Calling onSetValue()');
            var success = options.onSetValue.call(container, value, html);
            if (success === false)
                return false;
        }

        if (success === undefined) {
            //Set the new value to the container
            debug('Setting value for container');
            if (container.hasClass(options.combobox.css)) {
                container.attr('value', newValue);
            }
            else if (container.hasClass(options.checkbox.css)) {
                container.attr('value', newValue);
                newHtml = (newValue == options.checkbox.checked.value) ? options.checkbox.checked.html : options.checkbox.unchecked.html;
            }
            if (newHtml === null || newHtml === undefined)
                newHtml = newValue;
            container.html(newHtml);
        }

        container.unbind('mouseleave', container_mouseleave);

        if (container[0] === options.editor._focusedContainer) {
            debug("Closed the current editing container.");
            options.editor._focusedContainer = null;
        }

        //Update the containers change-status
        if (newValue != oldValue) {
            container.addClass('changed');
            debug("Flagged the container as changed");
        }
        else {
            container.removeClass('changed');
            container.data('liveeditor-old', undefined);
            debug("Flagged the container as unchanged");
        }
        return true;
    }

    function containerChanged (container) {
        var options = container.data('liveeditor-options');
        if ($.isFunction(options.onChanged)) {
            debug("Calling onChanged()");
            options.onChanged.call(container);
        }
    }



    ///
    /// Private Editor methods
    ///

    //Display editor when mouse hovers over an editable container
    function displayEditor(container) {
        debug('liveeditor.displayEditor(container)');
        var options = container.data('liveeditor-options');

        var editor = $('.liveeditor', container);
        if (editor.length) {
            debug("Using the existing editor for the requested container instead of creating a new.");
            return editor; //Already an editor in this container
        }

        var currentValue = getContainerValue(container);
        if (container.data('liveeditor-old') === undefined) {
            container.data('liveeditor-old', currentValue);
        }

        var editor = createEditor(container, currentValue);
        editor.addClass('liveeditor').data('liveeditor-original', currentValue);
        editor.focus(editor_focus);
        container
            .html(editor)
            .mouseleave(container_mouseleave);
        debug("Added editor to the container");

        if ($.isFunction(options.onEditorOpened)) {
            debug("Calling onEditorOpened");
            options.onEditorOpened.call(container, editor);
        }

        debug("liveeditor.displayEditor() DONE");
        return editor;
    }

    function createEditor(container, value) {
        var editor;
        var options = container.data('liveeditor-options');

        var event = options.onEditorCreating;
        if (event) {
            editor = event(container, value);
        }

        if (!editor) {
            if (container.hasClass(options.combobox.css)) {
                editor = $('<select>').width(container.width() - EDITOR_MARGIN);
                var select_options = options.onEditorOptions.call(container);
                switch ($.type(select_options)) {
                    case "string": editor.append($(select_options)); break;
                    default:
                        debug('appending ' + $.type(select_options) + ' options is not supported.');
                        break;
                }
                $('option[value="' + value + '"]', editor).prop('selected', true);
            } else if (container.hasClass(options.checkbox.css))
                editor = $('<input type="checkbox"/>').prop('checked', (value == options.checkbox.checked.value));
            else {
                editor = $('<input type="text"/>').width(container.width() - EDITOR_MARGIN).val(value);
            }
        }

        if (options.editor.css) {
            editor.addClass(options.editor.css);
        }

        return editor;
    }

    //Restore "label" in the container with the new value from the editor
    function commitEditor(obj) {
        debug("liveeditor.commitEditor(obj)");
        var container = $(obj);
        var editor = $('.liveeditor', container);
        if (!editor.length) {
            debug("Found no editor to hide for the requested container. Aborting!");
            return true; //No editor to hide
        }
        var originalValue = editor.data('liveeditor-original');
        var newValue = getEditorValue(editor);
        var newHtml = getEditorHtml(editor);
        if (!updateContainer(container, newValue, newHtml))
            return false;

        var options = container.data('liveeditor-options');
        if (originalValue != newValue) {
            containerChanged(container);
        }
        //Throw the hidden event
        if ($.isFunction(options.onEditorClosed)) {
            debug("Calling onEditorClosed()");
            options.onEditorClosed.call(container);
        }
        return true;
    }

    ///
    /// Method to get the current value from the editor.
    /// Returns the editors value, which MAY differ from its displayed text (for checkboxes/comboboxes for instance).
    ///
    function getEditorValue(editor) {
        debug('liveeditor.getEditorValue()');
        var value;
        var container = editor.closest('.liveedit');
        var options = container.data('liveeditor-options');

        if ($.isFunction(options.onEditorGetValue)) {
            debug('Calling onEditorGetValue()');
            value = options.onEditorGetValue.call(editor);
        }

        if (!value) {
            debug('Getting editor value');
            if (editor.is(':checkbox'))
                value = (editor.prop('checked')
                    ? options.checkbox.checked.value
                    : options.checkbox.unchecked.value);
            else if (editor.is('select'))
                value = $('option:selected', editor).val();
            else
                value = editor.val();
        }

        debug('liveeditor.getEditorValue() returns ' + value);
        return value;
    }

    ///
    /// Method to get the current display text from the editor
    /// Returns the displayed text in the editor, which MAY differ from its value (for checkboxes/comboboxes for instance).
    ///
    function getEditorHtml (editor) {
        debug('liveeditor.getEditorHtml()');
        var html;
        var container = editor.closest('.liveedit');
        var options = container.data('liveeditor-options');

        if ($.isFunction(options.onEditorGetValue)) {
            debug('Calling onEditorGetHtml()');
            html = options.onEditorGetHtml.call(editor);
        }

        if (editor.is('select'))
            html = $(':selected', editor).text();
        else
            html = null;

        debug('liveeditor.getEditorHtml() returns ' + html);
        return html;
    }









    //called on the native object directly, wrap with $(obj) if needed.
    function initializeObject(obj, options) {
        //assign the options to the object instance.
        $(obj).data('liveeditor-options', options);

        //do other initialization tasks on the individual item here...
    }

    ///
    /// LiveEditor Initiator
    /// Use this method to unobtrusively initialize liveeditor for a group of containers.
    /// For example: $('table tbody tr td.editable').liveeditor();
    ///

    $.fn.liveeditor = function (options) {
        debug("jQuery.liveeditor initializing for selection");

        //Build options for the new instance
        var mergedOptions = $.extend({}, defaultOptions, options)
        mergedOptions.editor._focusedContainer = null; //This is just an internal state-variable, so DON'T expose it in defaultOptions!
        //Initialize all objects in the selection
        this.each(function () {
            initializeObject(this, mergedOptions);
        });
        //Enable all objects in the selection
        debug("Enabling selection");
        $.liveeditor.enable(this);

        //TODO: Consider iterating all items in the selector and updating their html if they are checkboxes or comboboxes, to make sure the server generated code isn't diffrent from client side
        //TODO: $('.combo,.checkbox', this).each(function(){ updateContainer(this, this.attr(value)); });

        debug("jQuery.liveeditor initializing DONE");
        return this;
    }

} (jQuery));
