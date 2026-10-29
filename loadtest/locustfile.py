"""N-01 load test: 200 concurrent staff on the "Scale Test Firm" (`make seed-scale` first).

Each virtual user signs in once (allauth headless, session + CSRF like the SPA) and then does what
staff do all day: My work, project list, the 1,000-sheet register, dashboards, search, sheet detail.
Targets (docs/03 N-01): API p95 < 300 ms; register < 1 s; dashboards < 2 s. Run: `make loadtest`.
"""

import itertools
import os
import random

from locust import HttpUser, between, task

PASSWORD = "scale-Password-123!"  # seed_scale's test password (never seeded in production)
USER_IDS = itertools.count(1)  # scale-user-0 is the Owner (sees every project); staff 1..199
BIG = "S000"  # seed_scale puts the 1,000-sheet register on the first project
SEARCH_TERMS = ["Plan", "Duct", "Section", "Riser", "Lighting", "A-1"]
# Locust reaches Caddy as http://caddy:8080; Django only accepts its ALLOWED_HOSTS names.
HOST_HEADER = os.environ.get("LOAD_HOST_HEADER", "localhost:8080")


class Staff(HttpUser):
    wait_time = between(1, 4)

    def on_start(self) -> None:
        i = next(USER_IDS)
        n = 0 if i % 10 == 0 else (i % 199) + 1  # every 10th session is the Owner
        self.client.headers["Host"] = HOST_HEADER
        self.client.get("/_allauth/browser/v1/config", name="auth config")
        r = self.client.post(
            "/_allauth/browser/v1/auth/login",
            json={"email": f"scale-user-{n}@scale.example", "password": PASSWORD},
            headers=self._csrf(),
            name="sign in",
        )
        r.raise_for_status()
        projects = self.client.get("/api/v1/projects?page_size=50", name="/projects").json()
        self.projects = [p["id"] for p in projects["results"]]
        found = self.client.get(f"/api/v1/projects?q={BIG}", name="/projects?q").json()["results"]
        # Only the big project's team and the Owner can see it (membership scoping).
        self.big = next((p["id"] for p in found if p["code"] == BIG), None)
        self.sheets: list[str] = []

    def _csrf(self) -> dict[str, str]:
        token = self.client.cookies.get("csrftoken", "")
        return {"X-CSRFToken": token, "Referer": f"http://{HOST_HEADER}/sign-in"}

    @task(4)
    def my_work(self) -> None:
        self.client.get("/api/v1/me", name="/me")
        self.client.get("/api/v1/dashboards/me", name="/dashboards/me")
        self.client.get("/api/v1/notifications", name="/notifications")

    @task(4)
    def register(self) -> None:
        if not self.projects:
            return
        project = random.choice(self.projects)  # noqa: S311 - load mix, not security
        r = self.client.get(f"/api/v1/projects/{project}/sheets", name="/projects/{id}/sheets")
        if r.ok:
            body = r.json()  # the register is one unpaginated list (virtualised in the SPA)
            rows = body["results"] if isinstance(body, dict) else body
            self.sheets = [s["id"] for s in rows][:20]

    @task(2)
    def big_register(self) -> None:
        if self.big is None:
            return
        with self.client.get(
            f"/api/v1/projects/{self.big}/sheets",
            name="/projects/{id}/sheets (1,000 sheets)",
            catch_response=True,
        ) as r:
            if r.ok and len(r.json()) < 1000:
                r.failure(f"expected the 1,000-sheet register, got {len(r.json())} rows")

    @task(2)
    def sheet_detail(self) -> None:
        if self.sheets:
            sheet = random.choice(self.sheets)  # noqa: S311
            self.client.get(f"/api/v1/sheets/{sheet}/detail", name="/sheets/{id}/detail")

    @task(2)
    def project_dashboard(self) -> None:
        if not self.projects:
            return
        project = random.choice(self.projects)  # noqa: S311
        self.client.get(f"/api/v1/dashboards/projects/{project}", name="/dashboards/projects/{id}")

    @task(1)
    def search(self) -> None:
        q = random.choice(SEARCH_TERMS)  # noqa: S311
        self.client.get(f"/api/v1/search?q={q}", name="/search")

    @task(1)
    def reviews(self) -> None:
        self.client.get("/api/v1/reviews", name="/reviews")
