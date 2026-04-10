from datetime import datetime


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def model_to_overview(instance, fields):
    return {field: getattr(instance, field, None) for field in fields}
