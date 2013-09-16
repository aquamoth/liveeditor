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

    ///
    /// LiveEditor Initiator
    /// Use this method to unobtrusively initialize liveeditor for a group of containers.
    /// For example: $('table tbody tr td.editable').liveeditor();
    ///

    $.fn.liveeditor = function (options) {

        // Establish our default settings
        settings = $.extend({}, default_settings, options);

        //TODO: Consider iterating all items in the selector and updating their html if they are checkboxes or comboboxes, to make sure the server generated code isn't diffrent from client side
        //TODO: $('.combo,.checkbox', this).each(function(){ set(this, this.attr(value)); });
        this.addClass('liveedit').mouseenter(container_mouseenter);
        return this;
    }

    ///
    /// Public LiveEditor Commands
    ///

    $.liveeditor = {
        //version: function () {
        //    return "0.0.1";
        //},

        ///
        /// Object that holds the liveeditors default values.
        /// This object is read-only. Making changes to it will not affect the liveeditors functionality.
        ///
        defaults: default_settings,

        ///
        /// Enables editing for an unregistered or previously disabled container.
        ///
        enable: function (container) {
            debug("jQuery.liveeditor.enable(container)");
            if (!container.hasClass('liveedit'))
                container.addClass('liveedit').mouseenter(container_mouseenter);
        },

        ///
        /// Disables editing for a registered container.
        ///
        disable: function (container) {
            debug("jQuery.liveeditor.disable(container)");
            if (container.hasClass('liveedit'))
                container.removeClass('liveedit').unbind('mouseenter', container_mouseenter);
        },

        ///
        /// Forces the open editor to save its changes back to its container and close.
        /// Call this method before saving to make sure all changes have been committed.
        ///
        closeEditor: function (container) {
            debug("jQuery.liveeditor.closeEditor(container)");
            if (container||null === null)
                container = current_editing_container;
            return page_hide_editor(container);
        },

        ///
        /// Changes the value of a container as if the user had edited it with the editor.
        ///
        set: function (container, value, html) {
            debug("jQuery.liveeditor.set(container, value, html)");
            var originalValue = settings.get_container_value(container);
            if (container.attr('liveold') === undefined) {
                container.attr('liveold', originalValue);
            }
            if (!set(container, value, html))
                return false;
            if (value !== originalValue) {
                changed(container);
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
            container.removeAttr('liveold');
            changed(container);
        }
    };

    ///
    /// Private Methods
    ///

    var EDITOR_MARGIN = 5;//TODO: WHY do we need to remove this margin to make the input/select fit its parent container?

    var settings;

    var default_settings = {
        debug: false,
        editorCss: '',

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
        /// Method called to create a new editor.
        /// creating() can be overloaded to add support for new types of editors.
        /// Returns a new editor object.
        ///
        creating: function (container, value) {
            var editor;
            if (container.hasClass(settings.combobox.css)) {
                editor = $('<select>').width(container.width() - EDITOR_MARGIN);
                var select_options = settings.get_container_options(container);
                switch ($.type(select_options)) {
                    case "string": editor.append($(select_options)); break;
                    default:
                        debug('appending ' + $.type(select_options) + ' options is not supported.');
                        break;
                }
                $('option[value="' + value + '"]', editor).prop('selected', true);
            } else if (container.hasClass(settings.checkbox.css))
                editor = $('<input type="checkbox"/>').prop('checked', (value == settings.checkbox.checked.value));
            else {
                editor = $('<input type="text"/>').width(container.width() - EDITOR_MARGIN).val(value);
            }
            debug(editor);
            return editor.addClass(settings.editorCss);
        },

        ///
        /// Event called to get valid options for a combobox editor
        /// get_container_options() must be overloaded if the comboboxes shall have any options.
        /// Returns a string with <option /> elements to display.
        ///
        get_container_options: function (container) { return {}; },

        ///
        /// Method called to get the current value of a container before displaying its editor.
        /// get_container_value() can be overloaded if the container does not store its value in LiveEditors default way.
        /// Obs! Remember to overload set_container_value() too if changing this method.
        /// Returns the containers current value as a string.
        ///
        get_container_value: function (container) { return container.hasClass(settings.combobox.css) || container.hasClass(settings.checkbox.css) ? container.attr('value') : container.text(); },

        ///
        /// Method called to set the new value of a container and at the same time closing the editor.
        /// set_container_value() can be overloaded if the container does not store its value in LiveEditors default way.
        /// Obs! Remember to overload get_container_value() too if changing this method.
        /// Returns true if the value was written and the editor was closed. 
        /// It is also possible to cancel the closing of the editor by returning false from this method.
        ///
        set_container_value: function (container, value, html) {
            if (container.hasClass(settings.combobox.css)) {
                container.attr('value', value);
            }
            else if (container.hasClass(settings.checkbox.css)) {
                container.attr('value', value);
                html = (value == settings.checkbox.checked.value) ? settings.checkbox.checked.html : settings.checkbox.unchecked.html;
            }
            if (html === null || html === undefined)
                html = value;
            container.html(html);
            return true;
        },

        ///
        /// Method to get the current value from the editor.
        /// Returns the editors value, which MAY differ from its displayed text (for checkboxes/comboboxes for instance).
        ///
        get_editor_value: function (editor) {
            if (editor.is(':checkbox'))
                return (editor.prop('checked')
                    ? settings.checkbox.checked.value
                    : settings.checkbox.unchecked.value);
            else if (editor.is('select'))
                return $('option:selected', editor).val();
            else
                return editor.val();
        },

        ///
        /// Method to get the current display text from the editor
        /// Returns the displayed text in the editor, which MAY differ from its value (for checkboxes/comboboxes for instance).
        ///
        get_editor_text: function (editor) {
            if (editor.is('select'))
                return $(':selected', editor).text();
            else
                return null;
        },

        ///
        /// Event called after the editor is shown.
        ///
        shown: null,

        ///
        /// Event called after the editor receives focus.
        ///
        focused: null,

        ///
        /// Event called after the editor is closed.
        ///
        hidden: null,

        ///
        /// Event called when the container changes value after the editor has been closed.
        ///
        changed: null
    };

    var current_editing_container = null;

    function debug(msg) {
        if (settings.debug && console)
            console.log(msg);
    }

    //Display editor when mouse hovers over an editable container
    function page_display_editor(container) {

        debug('liveeditor.page_display_editor(container)');

        var editor = $('.liveeditor', container);
        if (editor.length) {
            debug("Using the existing editor for the requested container instead of creating a new.");
            return editor; //Already an editor in this container
        }

        var currentValue = settings.get_container_value(container);
        if (container.attr('liveold') === undefined) {
            container.attr('liveold', currentValue);
        }
        var editor = settings
            .creating(container, currentValue)
            .addClass('liveeditor');
        editor.attr('original', currentValue);
        editor.focus(page_editor_focus);
        container
            .html(editor)
            .mouseleave(container_mouseleave);
        debug("Added editor to the container");

        if ($.isFunction(settings.shown))
            settings.shown.call(container, editor);
        return editor;
    }

    function container_mouseenter() {
        debug("liveeditor.container_mouseenter()");
        page_display_editor($(this));
    }

    function container_mouseleave() {
        debug("liveeditor.container_mouseleave()");
        page_hide_editor($(this));
    }

    //Restore "label" in the container with the new value from the editor
    function page_hide_editor(container) {
        debug("liveeditor.page_hide_editor(container)");
        var editor = $('.liveeditor', container);
        if (!editor.length) {
            debug("Found no editor to hide for the requested container. Aborting!");
            return true; //No editor to hide
        }
        var originalValue = editor.attr('original');
        var newValue = settings.get_editor_value(editor);
        var newHtml = settings.get_editor_text(editor);
        if (!set(container, newValue, newHtml))
            return false;
        if (originalValue != newValue) {
            changed(container);
        }
        //Throw the hidden event
        if ($.isFunction(settings.hidden))
            settings.hidden.call(container);
        return true;
    }

    function set(container, newValue, newHtml) {
        debug("liveeditor.set(container, newValue, newHtml)");
        var oldValue = container.attr('liveold');
        if (!settings.set_container_value(container, newValue, newHtml))
            return false;
        container.unbind('mouseleave', container_mouseleave);
        if (newValue != oldValue) {
            container.addClass('changed');
            debug("Flagged the container as changed");
        }
        else {
            container.removeClass('changed');
            container.removeAttr('liveold');
            debug("Flagged the container as unchanged");
        }
        if (container === current_editing_container) {
            debug("Closed the current editing container.");
            current_editing_container = null;
        }
        return true;
    }

    function changed(container) {
        if ($.isFunction(settings.changed))
            settings.changed.call(container);
    }

    //Make the editor "sticky" so it doesn't disappear when the mouse is moved from the container
    function page_editor_focus() {
        debug('liveeditor.page_editor_focus()');

        var editor = $(this)
            .unbind('focus', page_editor_focus)
            .select();
        var container = editor.closest('.liveedit')
            .unbind('mouseleave', container_mouseleave);

        if (container === current_editing_container) {
            debug('It is the current editing container that got focus. Ignore?!');
            return true; //Already an editor in the requested container
        }

        if (current_editing_container) {
            debug('Closing old editing container.');
            if (!page_hide_editor(current_editing_container))
                return false;
        }

        current_editing_container = container;
        editor.keydown(editor_keydown);
        if ($.isFunction(settings.focused))
            settings.focused.call(container, editor);
        return true;
    }

    //Handle editor TAB and ESC keys
    function editor_keydown(e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode == 27) {       // ESC
            e.preventDefault();
            if (!current_editing_container) {
                debug("Got ESC keydown for an editor without having a current container. Aborting!");
                return;
            }
            page_hide_editor(current_editing_container);
        }
        else if (keyCode == 9) {    //TAB
            e.preventDefault();
            if (!current_editing_container) {
                debug("Got TAB keydown for an editor without having a current container. Aborting!");
                return;
            }

            //Close the current editor
            var nextContainer = current_editing_container
            page_hide_editor(current_editing_container);

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
                        page_display_editor(nextContainer).focus();
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

} (jQuery));
