import logging

from flask import Flask, jsonify
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def create_app() -> Flask:
    app = Flask(__name__)

    from app.core.config import Config
    app.config.from_object(Config)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": ["http://localhost:3000"],
                "methods": ["GET", "POST", "OPTIONS"],
                "allow_headers": ["Content-Type"],
                "max_age": 600,
            }
        },
    )

    from app.routes.inference import inference_bp
    from app.routes.roi import roi_bp
    app.register_blueprint(inference_bp)
    app.register_blueprint(roi_bp)

    _register_error_handlers(app)

    from app.core.model_loader import load_model
    load_model()

    return app


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"success": False, "error": {"code": "BAD_REQUEST", "message": str(e)}}), 400

    @app.errorhandler(413)
    def request_too_large(e):
        return jsonify({"success": False, "error": {"code": "FILE_TOO_LARGE", "message": "El archivo supera el tamaño máximo de 10 MB."}}), 413

    @app.errorhandler(415)
    def unsupported_media(e):
        return jsonify({"success": False, "error": {"code": "UNSUPPORTED_FORMAT", "message": "Formato de archivo no soportado."}}), 415

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": {"code": "NOT_FOUND", "message": "Endpoint no encontrado."}}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"success": False, "error": {"code": "INTERNAL_ERROR", "message": "Error interno del servidor."}}), 500
