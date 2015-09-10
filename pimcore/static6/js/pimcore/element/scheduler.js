/**
 * Pimcore
 *
 * LICENSE
 *
 * This source file is subject to the new BSD license that is bundled
 * with this package in the file LICENSE.txt.
 * It is also available through the world-wide-web at this URL:
 * http://www.pimcore.org/license
 *
 * @copyright  Copyright (c) 2009-2014 pimcore GmbH (http://www.pimcore.org)
 * @license    http://www.pimcore.org/license     New BSD License
 */

pimcore.registerNS("pimcore.element.scheduler");
pimcore.element.scheduler = Class.create({

    initialize: function(element, type) {
        this.element = element;
        this.type = type;
    },

    getLayout: function () {

        if (this.layout == null) {

            var tasksData = [];
            var d = null;
            var rawTask = [];

            if (this.element.data.scheduledTasks.length > 0) {
                for (var i = 0; i < this.element.data.scheduledTasks.length; i++) {
                    rawTask = this.element.data.scheduledTasks[i];
                    d = new Date(intval(rawTask.date) * 1000);
                    tasksData.push([Date.parse(Ext.Date.format(d, "n/j/Y"), "n/j/Y"),

                        Ext.Date.format(d, "H:i"), rawTask.action,
                                                            rawTask.version, rawTask.active]);
                }
            }

            var store = new Ext.data.SimpleStore({
                fields: ['date', 'time',"action","version","active"],
                data: tasksData
            });

            var actionTypes = null;
            if (this.type == "document") {
                actionTypes = new Ext.data.SimpleStore({
                    fields: ['key', 'name'],
                    data: [
                        ["publish", t("publish")],
                        ["unpublish", t("unpublish")],
                        ["delete", t("delete")],
                        ["publish-version", t("publish_version")]
                    ]
                });
            }
            else if (this.type == "asset") {
                actionTypes = new Ext.data.SimpleStore({
                    fields: ['key', 'name'],
                    data: [
                        ["delete", t("delete")],
                        ["publish-version", t("publish_version")]
                    ]
                });
            }
            else if (this.type == "object") {
                actionTypes = new Ext.data.SimpleStore({
                    fields: ['key', 'name'],
                    data: [
                        ["publish", t("publish")],
                        ["unpublish", t("unpublish")],
                        ["delete", t("delete")],
                        ["publish-version", t("publish_version")]
                    ]
                });
            }

            this.versions = new Ext.data.Store({
                autoDestroy: true,
                proxy: {
                    type: 'ajax',
                    url: "/admin/" + this.type + "/get-versions",
                    extraParams: {
                        id: this.element.id
                    },
                    reader: {
                        type: 'json',
                        rootProperty: 'versions'
                    }
                },
                fields: ['id', {name: 'date', convert: function (v, rec) {
                    var d = new Date(intval(v) * 1000);

                    var ret = Ext.Date.format(d, "Y-m-d H:i");
                    if (rec.data.user) {
                        ret += " - " + rec.data.user.name;
                    }
                    return ret;
                }}, 'note', {name:'name', convert: function (v, rec) {
                    if (rec.data.user) {
                        if (rec.data.user.name) {
                            return rec.data.user.name;
                        }
                    }
                    return null;
                }}]
            });

            var checkColumn = Ext.create('Ext.grid.column.Check', {
                header: t("active"),
                dataIndex: 'active',
                width: 50,
                sortable: true
            });

            var propertiesColumns = [
                {header: t("date"), width: 100, sortable: true, dataIndex: 'date', editor: new Ext.form.DateField(),
                    renderer: function(d) {
                        return  Ext.Date.format(d, "Y-m-d");
                    }
                },
                {header: t("time"), width: 80, sortable: true, dataIndex: 'time', editor: new Ext.form.TimeField({
                    format: "H:i"
                    }),
                    renderer: function(d) {
                        return  Ext.Date.format(d, "H:i");
                    }
                },
                {header: t("action"), width: 100, sortable: false, dataIndex: 'action', editor: new Ext.form.ComboBox({
                    triggerAction: 'all',
                    editable: false,
                    store: actionTypes,
                    displayField:'name',
                    valueField: "key",
                    mode: 'local'
                }),renderer: function(value, metaData, record, rowIndex, colIndex, store, view) {
                    try {
                        var rec = actionTypes.findRecord("name", value);
                        if (rec) {
                            return rec.get("name");
                        }
                    }
                    catch (e) {

                    }

                    return "";
                }},
                {header: t("version"), width: 200, sortable: false, dataIndex: 'version',
                    editor: new Ext.form.ComboBox({
                        triggerAction: 'all',
                        editable: false,
                        store: this.versions,
                        displayField:'date',
                        valueField: "id",
                        listeners: {
                            "expand": function (el) {
                                el.getStore().reload();
                            }
                        }
                    })
                },
                checkColumn,
                {
                    xtype: 'actioncolumn',
                    width: 30,
                    items: [{
                        tooltip: t('delete'),
                        icon: "/pimcore/static/img/icon/cross.png",
                        handler: function (grid, rowIndex) {
                            grid.getStore().removeAt(rowIndex);
                        }.bind(this)
                    }]
                }
            ];

            this.cellEditing = Ext.create('Ext.grid.plugin.CellEditing', {
                clicksToEdit: 1
            });

            this.grid = Ext.create('Ext.grid.Panel', {
                frame: false,
                autoScroll: true,
                store: store,
                stripeRows: true,
                trackMouseOver: true,
                columnLines: true,
                //plugins: checkColumn,
                columns : propertiesColumns,
                tbar: [
                    {
                        text: t('add'),
                        handler: this.onAdd.bind(this),
                        iconCls: "pimcore_icon_add"
                    },
                    '-',
                    {
                        text: t('delete'),
                        handler: this.onDelete.bind(this),
                        iconCls: "pimcore_icon_delete"
                    },
                    '-'
                ],
                plugins: [
                    this.cellEditing
                    ]
            });


            this.layout = new Ext.Panel({
                title: t('schedule'),
                border: false,
                iconCls: "pimcore_icon_tab_schedule",
                items: [this.grid],
                layout: "fit"
            });
        }

        return this.layout;
    },


    onAdd: function (btn, ev) {

        var model = this.grid.getStore().getModel();
        var u = new model();
        u.set("date", new Date());
        u.set("active", true);
        this.grid.store.insert(0, [u]);
    },

    onDelete: function () {
        var rec = this.grid.getSelectionModel().getSelectedCell();

        if (!rec) {
            return false;
        }
        this.grid.store.removeAt(rec[0]);
    },

    getValues: function () {

        if (!this.grid.rendered) {
            throw "scheduler not available";
        }

        var values = [];
        var data = this.grid.store.getRange();

        for (var i = 0; i < data.length; i++) {
            values.push({
                date:  Ext.Date.format(data[i].data.date, "Y-m-d"),
                time: data[i].data.time,
                action: data[i].data.action,
                version: data[i].data.version,
                active: data[i].data.active
            });
        }


        return values;
    }

});