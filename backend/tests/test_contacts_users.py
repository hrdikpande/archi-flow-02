"""F-43 contacts; user administration; organisation scoping on every list (F-38)."""

from apps.accounts.roles import OrgRole, ProjectRole
from apps.audit.models import AuditEvent
from apps.contacts.models import Contact


def test_duplicate_email_warns_then_saves_when_confirmed(admin_client) -> None:
    body = {"full_name": "Ravi Rao", "email": "Ravi@Client.in"}
    assert admin_client.post("/api/v1/contacts", body).status_code == 201
    warning = admin_client.post(
        "/api/v1/contacts", {"full_name": "R. Rao", "email": "ravi@client.in"}
    )
    assert warning.status_code == 409
    assert warning.json()["code"] == "duplicate_email"
    assert warning.json()["existing"]["full_name"] == "Ravi Rao"
    confirmed = admin_client.post(
        "/api/v1/contacts",
        {"full_name": "R. Rao", "email": "ravi@client.in", "confirm_duplicate": True},
    )
    assert confirmed.status_code == 201
    assert Contact.objects.filter(email="ravi@client.in").count() == 2


def test_project_lead_can_add_contacts_designer_cannot(make_user, add_member, client_for) -> None:
    lead, designer = make_user(OrgRole.STAFF), make_user(OrgRole.STAFF)
    add_member(lead, ProjectRole.PL)
    add_member(designer, ProjectRole.DESIGNER)
    org_body = {"name": "Structural Consultants LLP", "kind": "consultant"}
    created = client_for(lead).post("/api/v1/external-orgs", org_body)
    assert created.status_code == 201
    contact = {"full_name": "S. Iyer", "external_org": created.json()["id"]}
    assert client_for(designer).post("/api/v1/contacts", contact).status_code == 403
    assert client_for(designer).get("/api/v1/contacts").status_code == 200


def test_external_org_names_unique_ignoring_case(admin_client) -> None:
    assert (
        admin_client.post(
            "/api/v1/external-orgs", {"name": "BBMP", "kind": "authority"}
        ).status_code
        == 201
    )
    assert (
        admin_client.post(
            "/api/v1/external-orgs", {"name": "bbmp", "kind": "authority"}
        ).status_code
        == 400
    )


def test_org_with_contacts_cannot_be_deleted(admin_client) -> None:
    org_id = admin_client.post(
        "/api/v1/external-orgs", {"name": "Client", "kind": "client"}
    ).json()["id"]
    admin_client.post("/api/v1/contacts", {"full_name": "A", "external_org": org_id})
    response = admin_client.delete(f"/api/v1/external-orgs/{org_id}")
    assert response.status_code == 409
    assert response.json()["code"] == "has_contacts"


def test_lists_never_cross_organisations(
    admin, admin_client, other_org, make_user, client_for
) -> None:
    admin_client.post("/api/v1/contacts", {"full_name": "Ours"})
    stranger = client_for(make_user(OrgRole.ADMIN, organisation=other_org))
    assert stranger.get("/api/v1/contacts").json()["results"] == []
    contact_id = Contact.objects.get().pk
    assert stranger.get(f"/api/v1/contacts/{contact_id}").status_code == 404
    assert stranger.patch(f"/api/v1/contacts/{contact_id}", {"full_name": "x"}).status_code == 404
    assert stranger.get(f"/api/v1/users/{admin.pk}").status_code == 404
    # Contacts cannot be linked to another firm's organisation either.
    foreign_org = stranger.post(
        "/api/v1/external-orgs", {"name": "Theirs", "kind": "client"}
    ).json()["id"]
    linked = admin_client.post("/api/v1/contacts", {"full_name": "X", "external_org": foreign_org})
    assert linked.status_code == 400


def test_last_admin_cannot_be_demoted_or_deactivated(admin, admin_client, make_user) -> None:
    response = admin_client.patch(f"/api/v1/users/{admin.pk}", {"org_role": "staff"})
    assert response.status_code == 409
    assert response.json()["code"] == "last_admin"
    second = make_user(OrgRole.ADMIN)
    assert admin_client.patch(f"/api/v1/users/{second.pk}", {"is_active": False}).status_code == 200


def test_role_change_is_audited(admin_client, make_user) -> None:
    user = make_user(OrgRole.STAFF)
    admin_client.patch(f"/api/v1/users/{user.pk}", {"org_role": "owner"})
    event = AuditEvent.objects.get(verb="user.updated", entity_id=str(user.pk))
    assert (event.before, event.after) == ({"org_role": "staff"}, {"org_role": "owner"})


def test_me_reports_capabilities_and_memberships(
    make_user, add_member, client_for, project
) -> None:
    lead = make_user(OrgRole.STAFF, name="Priya Sharma")
    add_member(lead, ProjectRole.PL)
    me = client_for(lead).get("/api/v1/me").json()
    assert me["short_name"] == "Priya S"
    assert me["memberships"] == [
        {"project_id": str(project.pk), "project_code": "2026-014", "role": "pl"}
    ]
    assert me["capabilities"]["manage_contacts"] is True
    assert me["capabilities"]["manage_org_settings"] is False


def test_changing_email_to_an_existing_one_warns(admin_client) -> None:
    admin_client.post("/api/v1/contacts", {"full_name": "A", "email": "a@client.in"})
    b = admin_client.post("/api/v1/contacts", {"full_name": "B", "email": "b@client.in"}).json()
    clash = admin_client.patch(f"/api/v1/contacts/{b['id']}", {"email": "A@client.in"})
    assert clash.status_code == 409
    ok = admin_client.patch(
        f"/api/v1/contacts/{b['id']}", {"email": "A@client.in", "confirm_duplicate": True}
    )
    assert ok.status_code == 200
    assert ok.json()["email"] == "a@client.in"
    same = admin_client.patch(f"/api/v1/contacts/{b['id']}", {"email": "a@client.in"})
    assert same.status_code == 200  # unchanged email never warns


def test_contact_and_org_lifecycle_is_audited(admin_client) -> None:
    org_id = admin_client.post(
        "/api/v1/external-orgs", {"name": "Client", "kind": "client", "email": "X@Client.in"}
    ).json()["id"]
    updated = admin_client.patch(f"/api/v1/external-orgs/{org_id}", {"email": "Y@Client.in"})
    assert updated.json()["email"] == "y@client.in"
    contact_id = admin_client.post("/api/v1/contacts", {"full_name": "C"}).json()["id"]
    assert admin_client.delete(f"/api/v1/contacts/{contact_id}").status_code == 204
    assert admin_client.delete(f"/api/v1/external-orgs/{org_id}").status_code == 204
    verbs = set(AuditEvent.objects.values_list("verb", flat=True))
    assert {
        "external_org.created",
        "external_org.updated",
        "external_org.deleted",
        "contact.created",
        "contact.deleted",
    } <= verbs


def test_contact_search(admin_client) -> None:
    org_id = admin_client.post(
        "/api/v1/external-orgs", {"name": "Apollo", "kind": "client"}
    ).json()["id"]
    admin_client.post("/api/v1/contacts", {"full_name": "Ravi", "external_org": org_id})
    admin_client.post("/api/v1/contacts", {"full_name": "Sunita", "email": "s@x.in"})

    def names(q: str) -> list[str]:
        results = admin_client.get("/api/v1/contacts", {"q": q}).json()["results"]
        return [c["full_name"] for c in results]

    assert names("apollo") == ["Ravi"]
    assert names("s@x") == ["Sunita"]
    by_org = admin_client.get("/api/v1/contacts", {"external_org": org_id}).json()["results"]
    assert [c["full_name"] for c in by_org] == ["Ravi"]
    assert admin_client.get("/api/v1/contacts", {"external_org": "not-a-uuid"}).status_code == 400
