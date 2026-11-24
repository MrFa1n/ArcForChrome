# Formatting

- For repository-wide formatting, include Markdown documentation and both READMEs. Use Prettier for Markdown, JavaScript, CSS, JSON, and YAML, and Black for Python.
- Use the existing files in `extension/` as the source of truth for HTML formatting. In standalone pages, keep `<head>` and `<body>` flush with `<html>`, separate the document sections with blank lines, and indent their contents by two spaces. Exclude these HTML files from bulk Prettier passes.
