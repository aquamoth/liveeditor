///
/// LiveEditor jQuery plugin
///
/// Copyright 2013 Trustfall AB
/// Author Mattias Åslund
/// Licensed according to the MIT-license. Please read the file LICENSE for details.
///
;//Protection against other malformed scripts that can interfere 
(function ($) {

    var defaultOptions = {

        changedCss: 'liveeditor-changed',
        editorCss: null,

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

        ///
        /// Enables editing for an unregistered or previously disabled container.
        ///
        enable: function (container) {
            
            return enable(container);
        },

        ///
        /// Disables editing for a registered container.
        ///
        disable: function (container) {
            
            return disable(container);
        },

        ///
        /// Forces the open editor to save its changes back to its container and close.
        /// Call this method before saving to make sure all changes have been committed.
        ///
        closeEditor: function (selector) {
            
            selector.each(function () { commitEditor(this); });
            return selector;
            
        },

        ///
        /// Changes the value of a container as if the user had edited it with the editor.
        ///
        set: function (selector, value, html) {
            
            selector.each(function () {
                var container = $(this);
                var originalValue = getContainerValue(container);
                if (container.data('liveeditor-old') === undefined) {
                    container.data('liveeditor-old', originalValue);
                    
                }
                if (updateContainer(container, value, html)) {
                    if (value !== originalValue) {
                        containerChanged(container);
                    }
                }
            });
            return selector;
        },

        ///
        /// Resets the container to consider its current value the unchanged state.
        /// Call this method for all containers after saving to setup new change-tracking without reloading the entire page.
        ///
        reset: function (selector) {
            
            selector.each(function () {
                var container = $(this);
                var oldValue = container.data('liveeditor-old');
                if (oldValue) {
                    var newValue = getContainerValue(container);
                    if (newValue !== oldValue) {
                        
                        container.removeData('liveeditor-old');
                        var options = container.data('liveeditor-options');
                        if (options.changedCss)
                            container.removeClass(options.changedCss);
                        containerChanged(container);
                    }
                }
            });
            return selector;
        }
    };

    ///
    /// Private Event Listeners
    ///

    //Display the editor when the user hovers over the container
    function container_mouseenter() {
        
        displayEditor($(this));
    }

    function container_mouseleave() {
        
        commitEditor(this);//TODO: Should call cancelEditor() instead to make sure the value doesn't change
    }

    //Make the editor "sticky" when focused so it doesn't disappear when the mouse is moved from the container
    function editor_focus() {
        

        var editor = $(this)
            .unbind('focus', editor_focus)
            .select();
        var container = editor.parent()
            .unbind('mouseleave', container_mouseleave);

        var options = container.data('liveeditor-options');
        if (container[0] === options._focusedContainer) {
            
            return true; //Since the current containers editor is focused there is no other editor to close
        }

        if (options._focusedContainer) {
            
            if (!commitEditor(options._focusedContainer))
                return false;
        }

        
        options._focusedContainer = container[0];
        editor.keydown(editor_keydown);
        if ($.isFunction(options.onEditorFocused)) {
            
            options.onEditorFocused.call(container, editor);
        }
        return true;
    }

    //Handle editor TAB and ESC keys
    function editor_keydown(e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode == 13) {        // Enter
            e.preventDefault();
            var container = $(this).parent();
            commitEditor(container);
        }
        else if (keyCode == 27) {       // ESC
            e.preventDefault();
            var container = $(this).parent();
            commitEditor(container); //TODO: Change to cancelEditor(container);
        }
        else if (keyCode == 9) {    //TAB
            e.preventDefault();
            var container = $(this).parent();
            var options = container.data('liveeditor-options');

            //Close the current editor
            commitEditor(container);

            if (e.shiftKey) {
                //Find the previous element in the initialized selector
                
                var nextContainer = options._selector.last(); //Used only if we are at the first element in the selector
                options._selector.each(function () {
                    if (this === container[0])
                        return false;
                    nextContainer = $(this);
                });
            } else {
                //Find the next element in the initialized selector
                
                var found = false;
                nextContainer = options._selector.eq(0);//Used only if we are at the last element in the selector
                options._selector.each(function () {
                    if (found) {
                        //This is the next element in the selector
                        nextContainer = $(this);
                        return false;
                    }
                    else if (this === container[0]) {
                        //This is the current element in the selector
                        found = true;
                    }
                });
            }

            //Open the new editor
            displayEditor(nextContainer).focus();
        }
    }









    ///
    /// Private methods
    ///
    function enable(container) {
        if (container.data('liveeditor-enabled') !== true) {
            container
                .data('liveeditor-enabled', true)
                .mouseenter(container_mouseenter);
        }
        return container;
    }
    function disable(container) {
        if (container.data('liveeditor-enabled') === true) {
            container
                .data('liveeditor-enabled', false)
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
            
            value = options.onGetValue.call(container);
        }
        if (!value) {
            
            value = container.hasClass(options.combobox.css) || container.hasClass(options.checkbox.css) 
                ? container.attr('value') 
                : container.text(); 
        }
        
        return value;
    }

    ///
    /// Method called to set the new value of a container. If the container has an open editor it is closed by this commmand.
    /// Implement the events onGetValue() and onSetValue() if the container does not store its value in LiveEditors default way.
    /// Returns true if the value was written successfully and false if the operation was cancelled.
    ///
    function updateContainer(container, newValue, newHtml) {
        
        var success;

        var oldValue = container.data('liveeditor-old');
        

        //Let the user override the setting of the value to the container if he likes
        var options = container.data('liveeditor-options');
        if ($.isFunction(options.onSetValue)) {
            
            var success = options.onSetValue.call(container, value, html);
            if (success === false)
                return false;
        }

        if (success === undefined) {
            //Set the new value to the container
            
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

        if (container[0] === options._focusedContainer) {
            
            options._focusedContainer = null;
        }

        //Update the containers change-status
        if (newValue != oldValue) {
            
            if (options.changedCss)
                container.addClass(options.changedCss);
        }
        else {
            
            if (options.changedCss)
                container.removeClass(options.changedCss);
        }
        return true;
    }

    function containerChanged (container) {
        var options = container.data('liveeditor-options');
        if ($.isFunction(options.onChanged)) {
            
            options.onChanged.call(container);
        }
    }



    ///
    /// Private Editor methods
    ///

    //Display editor when mouse hovers over an editable container
    function displayEditor(container) {
        
        var options = container.data('liveeditor-options');

        var editor = container.children(0);
        if (editor.data('liveeditor-original')) {
            
            return editor; //Already an editor in this container
        }

        var currentValue = getContainerValue(container);
        if (container.data('liveeditor-old') === undefined) {
            container.data('liveeditor-old', currentValue);
            
        }

        var editor = createEditor(container, currentValue);
        editor.focus(editor_focus);
        container
            .html(editor)
            .mouseleave(container_mouseleave);
        

        if ($.isFunction(options.onEditorOpened)) {
            
            options.onEditorOpened.call(container, editor);
        }

        
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
                        
                        break;
                }
                $('option[value="' + value + '"]', editor).prop('selected', true);
            } else if (container.hasClass(options.checkbox.css))
                editor = $('<input type="checkbox"/>').prop('checked', (value == options.checkbox.checked.value));
            else {
                editor = $('<input type="text"/>').width(container.width() - EDITOR_MARGIN).val(value);
            }
        }

        editor.data('liveeditor-original', value);
        if (options.editorCss) {
            editor.addClass(options.editorCss);
        }

        return editor;
    }

    //Restore "label" in the container with the new value from the editor
    function commitEditor(obj) {
        
        var container = $(obj);
        var editor = container.children(0);
        if (!editor.length) {
            return true; //No editor to hide
        }
        var originalValue = editor.data('liveeditor-original');
        var newValue = getEditorValue(editor);
        var newHtml = getEditorHtml(editor);
        if (!updateContainer(container, newValue, newHtml)) {
            return false;
        }
        var options = container.data('liveeditor-options');
        if (originalValue != newValue) {
            containerChanged(container);
        }
        //Throw the hidden event
        if ($.isFunction(options.onEditorClosed)) {
            
            options.onEditorClosed.call(container);
        }
        return true;
    }

    ///
    /// Method to get the current value from the editor.
    /// Returns the editors value, which MAY differ from its displayed text (for checkboxes/comboboxes for instance).
    ///
    function getEditorValue(editor) {
        
        var value;
        var container = editor.parent();
        var options = container.data('liveeditor-options');

        if ($.isFunction(options.onEditorGetValue)) {
            
            value = options.onEditorGetValue.call(editor);
        }

        if (!value) {
            
            if (editor.is(':checkbox'))
                value = (editor.prop('checked')
                    ? options.checkbox.checked.value
                    : options.checkbox.unchecked.value);
            else if (editor.is('select'))
                value = $('option:selected', editor).val();
            else
                value = editor.val();
        }

        
        return value;
    }

    ///
    /// Method to get the current display text from the editor
    /// Returns the displayed text in the editor, which MAY differ from its value (for checkboxes/comboboxes for instance).
    ///
    function getEditorHtml (editor) {
        
        var html;
        var container = editor.parent();
        var options = container.data('liveeditor-options');

        if ($.isFunction(options.onEditorGetValue)) {
            
            html = options.onEditorGetHtml.call(editor);
        }

        if (editor.is('select'))
            html = $(':selected', editor).text();
        else
            html = null;

        
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
        

        //Build options for the new instance
        var mergedOptions = $.extend({}, defaultOptions, options)
        //This is just an internal state-variable, so DON'T expose it in defaultOptions!
        mergedOptions._focusedContainer = null;
        mergedOptions._selector = this;

        //Initialize all objects in the selection
        this.each(function () {
            initializeObject(this, mergedOptions);
        });
        //Enable all objects in the selection
        
        $.liveeditor.enable(this);

        //TODO: Consider iterating all items in the selector and updating their html if they are checkboxes or comboboxes, to make sure the server generated code isn't diffrent from client side
        //TODO: $('.combo,.checkbox', this).each(function(){ updateContainer(this, this.attr(value)); });

        
        return this;
    }

	

} (jQuery));
