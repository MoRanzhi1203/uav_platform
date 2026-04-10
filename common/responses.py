from rest_framework.response import Response


def api_response(data=None, msg="success", code=0, status=200):
    return Response({"code": code, "msg": msg, "data": data}, status=status)


def api_error(msg="error", code=1, status=400, data=None):
    return Response({"code": code, "msg": msg, "data": data}, status=status)
