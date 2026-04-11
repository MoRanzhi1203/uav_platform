CENTRAL_DB_APPS = {
    "system",
    "fleet",
    "tasking",
    "federation",
    "telemetry",
    "auth",
    "contenttypes",
    "sessions",
    "messages",
}

FOREST_DB_APPS = {"forest"}
AGRI_DB_APPS = {"agri"}
TERRAIN_DB_APPS = {"terrain"}


class MultiDBRouter:
    route_app_labels = {
        **{app_label: "default" for app_label in CENTRAL_DB_APPS},
        **{app_label: "forest" for app_label in FOREST_DB_APPS},
        **{app_label: "agri" for app_label in AGRI_DB_APPS},
        **{app_label: "terrain" for app_label in TERRAIN_DB_APPS},
    }

    def _database_for_app(self, app_label):
        return self.route_app_labels.get(app_label, "default")

    def db_for_read(self, model, **hints):
        return self._database_for_app(model._meta.app_label)

    def db_for_write(self, model, **hints):
        return self._database_for_app(model._meta.app_label)

    def allow_relation(self, obj1, obj2, **hints):
        db1 = self._database_for_app(obj1._meta.app_label)
        db2 = self._database_for_app(obj2._meta.app_label)
        if db1 == db2:
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        target_db = self._database_for_app(app_label)
        return db == target_db
