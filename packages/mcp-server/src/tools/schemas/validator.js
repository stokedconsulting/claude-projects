"use strict";
/**
 * Schema Validation Module
 *
 * Provides schema validation using ajv for JSON Schema Draft 2020-12 validation.
 * This module validates tool inputs and outputs against their defined schemas.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemaValidator = exports.SchemaValidator = void 0;
exports.validateToolInput = validateToolInput;
exports.validateToolOutput = validateToolOutput;
var ajv_1 = __importDefault(require("ajv"));
var index_js_1 = require("./index.js");
/**
 * Schema validator class
 *
 * Manages validation of tool inputs and outputs against JSON schemas.
 */
var SchemaValidator = /** @class */ (function () {
    function SchemaValidator() {
        this.validators = new Map();
        this.ajv = new ajv_1.default({
            allErrors: true,
            strict: false,
            keywords: ['description', 'examples', 'constraints', 'errorSchema'],
        });
        // Pre-compile all tool schemas
        this.initializeValidators();
    }
    /**
     * Initialize validators for all tool schemas
     */
    SchemaValidator.prototype.initializeValidators = function () {
        for (var _i = 0, _a = Object.entries(index_js_1.toolSchemas); _i < _a.length; _i++) {
            var _b = _a[_i], toolName = _b[0], schema = _b[1];
            try {
                // Extract the input schema
                var inputSchema = schema.input;
                if (inputSchema) {
                    var validator = this.ajv.compile(inputSchema);
                    this.validators.set("".concat(toolName, "_input"), validator);
                }
                // Extract the output schema
                var outputSchema = schema.output;
                if (outputSchema) {
                    var validator = this.ajv.compile(outputSchema);
                    this.validators.set("".concat(toolName, "_output"), validator);
                }
            }
            catch (error) {
                console.error("Failed to compile schema for tool: ".concat(toolName), error);
            }
        }
    };
    /**
     * Validate tool input parameters
     *
     * @param toolName - Name of the tool
     * @param input - Input parameters to validate
     * @returns Validation result with error details if validation fails
     */
    SchemaValidator.prototype.validateInput = function (toolName, input) {
        var _this = this;
        var validator = this.validators.get("".concat(toolName, "_input"));
        if (!validator) {
            return {
                valid: false,
                errors: [
                    {
                        path: 'root',
                        message: "No input schema found for tool: ".concat(toolName),
                        keyword: 'schema',
                    },
                ],
            };
        }
        var valid = validator(input);
        if (valid) {
            return { valid: true };
        }
        // Convert ajv errors to readable format
        var errors = (validator.errors || []).map(function (error) { return ({
            path: error.instancePath || 'root',
            message: _this.formatErrorMessage(error),
            keyword: error.keyword,
        }); });
        return { valid: false, errors: errors };
    };
    /**
     * Validate tool output
     *
     * @param toolName - Name of the tool
     * @param output - Output to validate
     * @returns Validation result with error details if validation fails
     */
    SchemaValidator.prototype.validateOutput = function (toolName, output) {
        var _this = this;
        var validator = this.validators.get("".concat(toolName, "_output"));
        if (!validator) {
            return {
                valid: false,
                errors: [
                    {
                        path: 'root',
                        message: "No output schema found for tool: ".concat(toolName),
                        keyword: 'schema',
                    },
                ],
            };
        }
        var valid = validator(output);
        if (valid) {
            return { valid: true };
        }
        // Convert ajv errors to readable format
        var errors = (validator.errors || []).map(function (error) { return ({
            path: error.instancePath || 'root',
            message: _this.formatErrorMessage(error),
            keyword: error.keyword,
        }); });
        return { valid: false, errors: errors };
    };
    /**
     * Get the schema for a tool
     *
     * @param toolName - Name of the tool
     * @returns Full schema definition or undefined
     */
    SchemaValidator.prototype.getSchema = function (toolName) {
        return index_js_1.toolSchemas[toolName];
    };
    /**
     * Get input schema for a tool
     *
     * @param toolName - Name of the tool
     * @returns Input schema definition or undefined
     */
    SchemaValidator.prototype.getInputSchema = function (toolName) {
        var schema = this.getSchema(toolName);
        return schema === null || schema === void 0 ? void 0 : schema.input;
    };
    /**
     * Get output schema for a tool
     *
     * @param toolName - Name of the tool
     * @returns Output schema definition or undefined
     */
    SchemaValidator.prototype.getOutputSchema = function (toolName) {
        var schema = this.getSchema(toolName);
        return schema === null || schema === void 0 ? void 0 : schema.output;
    };
    /**
     * Get error schema for a tool
     *
     * @param toolName - Name of the tool
     * @returns Error schema definition or undefined
     */
    SchemaValidator.prototype.getErrorSchema = function (toolName) {
        var schema = this.getSchema(toolName);
        return schema === null || schema === void 0 ? void 0 : schema.errorSchema;
    };
    /**
     * Get examples for a tool
     *
     * @param toolName - Name of the tool
     * @returns Examples object or undefined
     */
    SchemaValidator.prototype.getExamples = function (toolName) {
        var schema = this.getSchema(toolName);
        return schema === null || schema === void 0 ? void 0 : schema.examples;
    };
    /**
     * Format ajv error into human-readable message
     *
     * @param error - AJV validation error
     * @returns Formatted error message
     */
    SchemaValidator.prototype.formatErrorMessage = function (error) {
        var path = error.instancePath || 'root';
        switch (error.keyword) {
            case 'required':
                return "Missing required field: ".concat(error.params.missingProperty);
            case 'enum':
                return "Field \"".concat(path, "\" must be one of: ").concat(error.params.allowedValues.join(', '));
            case 'type':
                return "Field \"".concat(path, "\" must be of type \"").concat(error.params.type, "\"");
            case 'minimum':
                return "Field \"".concat(path, "\" must be >= ").concat(error.params.limit);
            case 'maximum':
                return "Field \"".concat(path, "\" must be <= ").concat(error.params.limit);
            case 'minLength':
                return "Field \"".concat(path, "\" must have minimum length of ").concat(error.params.limit);
            case 'maxLength':
                return "Field \"".concat(path, "\" must have maximum length of ").concat(error.params.limit);
            case 'format':
                return "Field \"".concat(path, "\" must be a valid ").concat(error.params.format);
            case 'additionalProperties':
                return "Field \"".concat(path, "\" has unexpected properties");
            default:
                return error.message || 'Validation error';
        }
    };
    return SchemaValidator;
}());
exports.SchemaValidator = SchemaValidator;
/**
 * Global schema validator instance
 */
exports.schemaValidator = new SchemaValidator();
/**
 * Validate tool input (convenience function)
 *
 * @param toolName - Name of the tool
 * @param input - Input parameters to validate
 * @returns True if valid, false otherwise
 */
function validateToolInput(toolName, input) {
    var result = exports.schemaValidator.validateInput(toolName, input);
    return result.valid;
}
/**
 * Validate tool output (convenience function)
 *
 * @param toolName - Name of the tool
 * @param output - Output to validate
 * @returns True if valid, false otherwise
 */
function validateToolOutput(toolName, output) {
    var result = exports.schemaValidator.validateOutput(toolName, output);
    return result.valid;
}
