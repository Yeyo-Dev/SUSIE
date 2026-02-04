# SUSIE Frontend

Este directorio está reservado para el Angular Workspace de SUSIE.

## Inicialización Manual Requerida

Debido a que Angular CLI requiere interacción para la configuración inicial, se recomienda ejecutar los siguientes comandos para generar la estructura completa:

### 1. Generar el Workspace (Si no existen archivos de configuración)
Si esta carpeta está vacía o solo contiene este README, ejecuta:
```bash
npx -p @angular/cli ng new susie-workspace --create-application=false --directory . --strict
```
*(Confirma si te pregunta sobre sobreescribir archivos)*

### 2. Generar la Aplicación Demo
```bash
npx -p @angular/cli ng generate application susie-demo --style=scss --routing=true
```

### 3. Generar la Librería de Proctoring
```bash
npx -p @angular/cli ng generate library ngx-susie-proctoring
```

## Estructura Final Esperada
```
frontend/
├── angular.json
├── package.json
├── projects/
│   ├── susie-demo/          # Aplicación principal (Host)
│   └── ngx-susie-proctoring/# Librería de lógica de negocio
└── ...
```
