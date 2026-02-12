# Déploiement — Scan Validation Service

**Service**: `scan-validation-service`  
**Port**: `3005`

---

## 1. Prérequis

1. PostgreSQL (DB: `event_planner_scan`)
2. Redis (queues)
3. Node.js LTS + npm

---

## 2. Variables d’Environnement

1. Copier `.env.example` → `.env`
2. Renseigner:
   - DB + Redis
   - `JWT_SECRET`
   - URLs des services nécessaires (core / ticket)

---

## 3. Installation

```
npm install
```

---

## 4. Démarrage

```
npm run start
```

---

## 5. Healthcheck

```
GET http://localhost:3005/api/health
```

