"""
Application errors. Raise these from data/service code; main.py turns them
into JSON responses of the form {"error": code, "message": message}.

Messages are shown to users as-is, so write a plain sentence that says what
went wrong and, where possible, what to do about it.
"""


class AppError(Exception):
    status = 500
    code = "internal_error"
    default_message = "Something went wrong on our side."

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


class NotFound(AppError):
    status = 404
    code = "not_found"
    default_message = "We couldn't find that."


class InvalidInput(AppError):
    status = 422
    code = "invalid_input"
    default_message = "Some of the request parameters aren't valid."


class UpstreamError(AppError):
    """Jolpica (or another data source) is down or sent something unusable."""

    status = 502
    code = "upstream_error"
    default_message = "The F1 data service isn't responding properly. Try again in a minute."


class DataNotAvailable(AppError):
    """The request is valid but the data doesn't exist (yet), e.g. no timing data."""

    status = 503
    code = "data_not_available"
    default_message = "This data isn't available yet."


class RateLimited(AppError):
    """We, or FastF1 on our behalf, made too many requests to a data source."""

    status = 503
    code = "rate_limited"
    default_message = "Too many requests to the F1 data service. Try again in a few minutes."


class Forbidden(AppError):
    status = 403
    code = "forbidden"
    default_message = "You can't do that from here."
