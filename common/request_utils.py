import json
from datetime import date, datetime, time
from decimal import Decimal


def parse_request_data(request):
    # DRF's Request may already have consumed the underlying stream.
    if hasattr(request, "data"):
        data = request.data
        if isinstance(data, dict):
            return dict(data)
        if data is not None:
            try:
                return dict(data)
            except (TypeError, ValueError):
                return {}

    if request.content_type and "application/json" in request.content_type:
        try:
            return json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return {}

    if hasattr(request, "POST"):
        return request.POST.dict()

    return {}


def serialize_instance(instance):
    data = {}
    for field in instance._meta.concrete_fields:
        value = getattr(instance, field.name)
        if isinstance(value, (datetime, date, time)):
            data[field.name] = value.isoformat(sep=" ")
        elif isinstance(value, Decimal):
            data[field.name] = float(value)
        else:
            data[field.name] = value
    return data


def update_instance_from_payload(instance, payload, editable_fields):
    for field_name in editable_fields:
        if field_name in payload:
            setattr(instance, field_name, payload[field_name])
    return instance


def get_object_or_none(queryset, **filters):
    try:
        return queryset.get(**filters)
    except queryset.model.DoesNotExist:
        return None


def serialize_queryset(queryset):
    return [serialize_instance(item) for item in queryset]
