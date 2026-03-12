import Datastore from "@seald-io/nedb";
import { EventEmitter } from "events";

class UserDB extends EventEmitter {
    constructor(filename = `users.kz`, options = {}) {
        super();

        this.options = {
            autoCompaction: true,
            compactionInterval: 30000,
            timestampData: true,
            ...options
        };

        this.db = new Datastore({
            filename,
            autoload: true,
            timestampData: this.options.timestampData
        });

        this.db.ensureIndex({ fieldName: "_id", unique: true });

        if (this.options.autoCompaction) {
            this.db.setAutocompactionInterval(this.options.compactionInterval);
        }
    }

    async getUser(id) {
        return new Promise((resolve, reject) => {
            this.db.findOne({ _id: id }, (err, doc) => {
                if (err) {
                    this.emit("error", {
                        operation: "getUser",
                        error: err,
                        id
                    });
                    return reject(err);
                }
                this.emit("get", { id, doc });
                resolve(doc);
            });
        });
    }

    async getUsers(ids) {
        return new Promise((resolve, reject) => {
            this.db.find({ _id: { $in: ids } }, (err, docs) => {
                if (err) {
                    this.emit("error", {
                        operation: "getUsers",
                        error: err,
                        ids
                    });
                    return reject(err);
                }
                resolve(docs);
            });
        });
    }

    async getAllUsers(query = {}, projection = {}) {
        return new Promise((resolve, reject) => {
            this.db.find(query, projection, (err, docs) => {
                if (err) {
                    this.emit("error", {
                        operation: "getAllUsers",
                        error: err
                    });
                    return reject(err);
                }
                this.emit("getAll", { count: docs.length });
                resolve(docs);
            });
        });
    }

    async ensureUser(id, data = {}) {
        return new Promise((resolve, reject) => {
            this.db.findOne({ _id: id }, (err, doc) => {
                if (err) {
                    this.emit("error", {
                        operation: "ensureUser",
                        error: err,
                        id
                    });
                    return reject(err);
                }

                if (doc) {
                    this.emit("userExists", { id, doc });
                    return resolve(doc);
                }

                const newUser = {
                    _id: id,
                    settings: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...data
                };

                this.db.insert(newUser, (err, inserted) => {
                    if (err) {
                        this.emit("error", {
                            operation: "ensureUser:insert",
                            error: err,
                            id
                        });
                        return reject(err);
                    }
                    this.emit("userCreated", { id, user: inserted });
                    resolve(inserted);
                });
            });
        });
    }

    async ensureUserWithDefaults(id, defaults) {
        let user = await this.getUser(id);

        if (!user) {
            const newUser = { _id: id };
            syncWithDefaults(newUser, defaults);
            await this.db.insert(newUser);
            return newUser;
        }

        const before = JSON.stringify(user);
        syncWithDefaults(user, defaults);
        const after = JSON.stringify(user);

        if (before !== after) {
            await this.setMany(id, user);
        }

        return user;
    }

    async createUser(id, data = {}) {
        const newUser = {
            _id: id,
            settings: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data
        };

        return new Promise((resolve, reject) => {
            this.db.insert(newUser, (err, inserted) => {
                if (err) {
                    this.emit("error", {
                        operation: "createUser",
                        error: err,
                        id
                    });
                    return reject(err);
                }
                this.emit("userCreated", { id, user: inserted });
                resolve(inserted);
            });
        });
    }

    async updateUser(id, data, upsert = false) {
        const updateData = {
            ...data,
            updatedAt: new Date()
        };

        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                { $set: updateData },
                { upsert },
                (err, numAffected) => {
                    if (err) {
                        this.emit("error", {
                            operation: "updateUser",
                            error: err,
                            id
                        });
                        return reject(err);
                    }
                    this.emit("userUpdated", { id, numAffected });
                    resolve(numAffected);
                }
            );
        });
    }

    async deleteUser(id) {
        return new Promise((resolve, reject) => {
            this.db.remove({ _id: id }, {}, (err, numRemoved) => {
                if (err) {
                    this.emit("error", {
                        operation: "deleteUser",
                        error: err,
                        id
                    });
                    return reject(err);
                }
                this.emit("userDeleted", { id, numRemoved });
                resolve(numRemoved);
            });
        });
    }

    async deleteUsers(query) {
        return new Promise((resolve, reject) => {
            this.db.remove(query, { multi: true }, (err, numRemoved) => {
                if (err) {
                    this.emit("error", {
                        operation: "deleteUsers",
                        error: err
                    });
                    return reject(err);
                }
                this.emit("usersDeleted", { numRemoved });
                resolve(numRemoved);
            });
        });
    }

    async set(id, path, value) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $set: {
                        [path]: value,
                        updatedAt: new Date()
                    }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "set",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    this.emit("fieldSet", {
                        id,
                        path,
                        value,
                        numAffected: num
                    });
                    resolve(num);
                }
            );
        });
    }

    async get(id, path, defaultValue = undefined) {
        const user = await this.getUser(id);
        if (!user) return defaultValue;

        const value = path.split(".").reduce((obj, key) => obj?.[key], user);

        return value !== undefined ? value : defaultValue;
    }

    async setMany(id, data) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $set: {
                        ...data,
                        updatedAt: new Date()
                    }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "setMany",
                            error: err,
                            id
                        });
                        return reject(err);
                    }
                    this.emit("fieldsSet", {
                        id,
                        fields: Object.keys(data),
                        numAffected: num
                    });
                    resolve(num);
                }
            );
        });
    }

    async unset(id, paths) {
        const pathsArray = Array.isArray(paths) ? paths : [paths];
        const unsetObj = pathsArray.reduce((obj, path) => {
            obj[path] = true;
            return obj;
        }, {});

        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $unset: unsetObj,
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "unset",
                            error: err,
                            id
                        });
                        return reject(err);
                    }
                    this.emit("fieldsUnset", {
                        id,
                        paths: pathsArray,
                        numAffected: num
                    });
                    resolve(num);
                }
            );
        });
    }

    async increment(id, path, amount = 1) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $inc: { [path]: amount },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "increment",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    this.emit("fieldIncremented", {
                        id,
                        path,
                        amount,
                        numAffected: num
                    });
                    resolve(num);
                }
            );
        });
    }

    async decrement(id, path, amount = 1) {
        return this.increment(id, path, -amount);
    }

    async multiply(id, path, multiplier) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $mul: { [path]: multiplier },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "multiply",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    resolve(num);
                }
            );
        });
    }

    async min(id, path, value) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $min: { [path]: value },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "min",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    resolve(num);
                }
            );
        });
    }

    async max(id, path, value) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $max: { [path]: value },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "max",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    resolve(num);
                }
            );
        });
    }

    async push(id, path, value) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $push: { [path]: value },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "push",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    this.emit("arrayPushed", {
                        id,
                        path,
                        value,
                        numAffected: num
                    });
                    resolve(num);
                }
            );
        });
    }

    async pushMany(id, path, values) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $push: { [path]: { $each: values } },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "pushMany",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    resolve(num);
                }
            );
        });
    }

    async addToSet(id, path, value) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $addToSet: { [path]: value },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "addToSet",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    resolve(num);
                }
            );
        });
    }

    async pull(id, path, value) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $pull: { [path]: value },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "pull",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    this.emit("arrayPulled", {
                        id,
                        path,
                        value,
                        numAffected: num
                    });
                    resolve(num);
                }
            );
        });
    }

    async pullMany(id, path, values) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $pull: { [path]: { $in: values } },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "pullMany",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    resolve(num);
                }
            );
        });
    }

    async pop(id, path, position = 1) {
        return new Promise((resolve, reject) => {
            this.db.update(
                { _id: id },
                {
                    $pop: { [path]: position },
                    $set: { updatedAt: new Date() }
                },
                {},
                (err, num) => {
                    if (err) {
                        this.emit("error", {
                            operation: "pop",
                            error: err,
                            id,
                            path
                        });
                        return reject(err);
                    }
                    resolve(num);
                }
            );
        });
    }

    async find(query, options = {}) {
        return new Promise((resolve, reject) => {
            let cursor = this.db.find(query, options.projection || {});

            if (options.sort) cursor = cursor.sort(options.sort);
            if (options.skip) cursor = cursor.skip(options.skip);
            if (options.limit) cursor = cursor.limit(options.limit);

            cursor.exec((err, docs) => {
                if (err) {
                    this.emit("error", { operation: "find", error: err });
                    return reject(err);
                }
                resolve(docs);
            });
        });
    }

    async findOne(query, projection = {}) {
        return new Promise((resolve, reject) => {
            this.db.findOne(query, projection, (err, doc) => {
                if (err) {
                    this.emit("error", { operation: "findOne", error: err });
                    return reject(err);
                }
                resolve(doc);
            });
        });
    }

    async count(query = {}) {
        return new Promise((resolve, reject) => {
            this.db.count(query, (err, count) => {
                if (err) {
                    this.emit("error", { operation: "count", error: err });
                    return reject(err);
                }
                resolve(count);
            });
        });
    }

    async exists(id) {
        const count = await this.count({ _id: id });
        return count > 0;
    }

    async search(field, term, options = {}) {
        const regex = new RegExp(term, "i");
        return this.find({ [field]: regex }, options);
    }

    async paginate(query = {}, page = 1, limit = 10, sort = {}) {
        const skip = (page - 1) * limit;
        const [docs, total] = await Promise.all([
            this.find(query, { skip, limit, sort }),
            this.count(query)
        ]);

        return {
            docs,
            total,
            page,
            pages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
        };
    }

    async distinct(field, query = {}) {
        const docs = await this.find(query, { projection: { [field]: 1 } });
        const values = docs.map(doc => {
            return field.split(".").reduce((obj, key) => obj?.[key], doc);
        });
        return [...new Set(values)].filter(v => v !== undefined);
    }

    async groupBy(field, query = {}) {
        const docs = await this.find(query);
        const groups = {};

        docs.forEach(doc => {
            const value = field
                .split(".")
                .reduce((obj, key) => obj?.[key], doc);
            const key = value !== undefined ? value : "undefined";
            groups[key] = (groups[key] || 0) + 1;
        });

        return groups;
    }

    async getSetting(id, key, defaultValue = undefined) {
        return this.get(id, `settings.${key}`, defaultValue);
    }

    async setSetting(id, key, value) {
        return this.set(id, `settings.${key}`, value);
    }

    async setSettings(id, settings) {
        const settingsObj = Object.keys(settings).reduce((obj, key) => {
            obj[`settings.${key}`] = settings[key];
            return obj;
        }, {});
        return this.setMany(id, settingsObj);
    }

    async deleteSetting(id, key) {
        return this.unset(id, `settings.${key}`);
    }

    async getAllSettings(id) {
        return this.get(id, "settings", {});
    }

    async bulkInsert(users) {
        const usersWithDefaults = users.map(user => ({
            settings: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            ...user
        }));

        return new Promise((resolve, reject) => {
            this.db.insert(usersWithDefaults, (err, docs) => {
                if (err) {
                    this.emit("error", { operation: "bulkInsert", error: err });
                    return reject(err);
                }
                this.emit("bulkInserted", { count: docs.length });
                resolve(docs);
            });
        });
    }

    async bulkUpdate(query, update) {
        return new Promise((resolve, reject) => {
            this.db.update(
                query,
                update,
                { multi: true },
                (err, numAffected) => {
                    if (err) {
                        this.emit("error", {
                            operation: "bulkUpdate",
                            error: err
                        });
                        return reject(err);
                    }
                    this.emit("bulkUpdated", { numAffected });
                    resolve(numAffected);
                }
            );
        });
    }

    async transaction(id, fn) {
        const user = await this.getUser(id);
        if (!user) throw new Error(`User ${id} not found`);

        const updates = await fn(user);
        await this.setMany(id, updates);

        return this.getUser(id);
    }

    async exportToJSON() {
        return this.getAllUsers();
    }

    async importFromJSON(data, clear = false) {
        if (clear) {
            await this.deleteUsers({});
        }
        return this.bulkInsert(data);
    }

    async compact() {
        return new Promise(resolve => {
            this.db.persistence.compactDatafile();
            this.emit("compacted");
            resolve();
        });
    }

    async loadDatabase() {
        return new Promise((resolve, reject) => {
            this.db.loadDatabase(err => {
                if (err) {
                    this.emit("error", {
                        operation: "loadDatabase",
                        error: err
                    });
                    return reject(err);
                }
                this.emit("databaseLoaded");
                resolve();
            });
        });
    }

    async ensureIndex(options) {
        return new Promise((resolve, reject) => {
            this.db.ensureIndex(options, err => {
                if (err) {
                    this.emit("error", {
                        operation: "ensureIndex",
                        error: err
                    });
                    return reject(err);
                }
                this.emit("indexCreated", options);
                resolve();
            });
        });
    }

    async removeIndex(fieldName) {
        return new Promise((resolve, reject) => {
            this.db.removeIndex(fieldName, err => {
                if (err) {
                    this.emit("error", {
                        operation: "removeIndex",
                        error: err
                    });
                    return reject(err);
                }
                this.emit("indexRemoved", { fieldName });
                resolve();
            });
        });
    }

    stopAutocompaction() {
        this.db.persistence.stopAutocompaction();
        this.emit("autocompactionStopped");
    }

    setAutocompactionInterval(interval) {
        this.db.setAutocompactionInterval(interval);
        this.emit("autocompactionIntervalChanged", { interval });
    }
}

function syncWithDefaults(target, defaults) {
    for (const key in target) {
        if (key === "_id") continue;
        if (!(key in defaults)) {
            delete target[key];
        }
    }

    for (const key in defaults) {
        const defVal = defaults[key];
        const curVal = target[key];

        if (curVal === undefined) {
            target[key] = structuredClone(defVal);
        } else if (
            typeof defVal === "object" &&
            defVal !== null &&
            !Array.isArray(defVal)
        ) {
            syncWithDefaults(curVal, defVal);
        }
    }

    return target;
}

export default new UserDB();
