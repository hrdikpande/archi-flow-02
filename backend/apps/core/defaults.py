"""Starting reference data. Placeholders until DEC-04/DEC-06 are taken in discovery."""

# 03 §5 / F-02: CoA-style stages. Only Concept and Preliminary percentages are given (10% each);
# the rest are 0 until the owner confirms them (AS-05, DEC-05). Saving a plan as final needs 100%.
DEFAULT_STAGE_TEMPLATE = [
    ("Concept", "10"),
    ("Preliminary", "10"),
    ("Approvals", "0"),
    ("Working drawings / GFC", "0"),
    ("Tender", "0"),
    ("Construction", "0"),
    ("Closure", "0"),
]

DEFAULT_DISCIPLINES = [
    ("A", "Architecture", r"^A-\d{3}$"),
    ("S", "Structure", r"^S-\d{3}$"),
    ("C", "Civil", r"^C-\d{3}$"),
    ("M", "HVAC (Mechanical)", r"^M-\d{3}$"),
    ("E", "Electrical", r"^E-\d{3}$"),
    ("P", "Plumbing (PHE)", r"^P-\d{3}$"),
    ("F", "Fire protection", r"^F-\d{3}$"),
    ("X", "ELV", r"^X-\d{3}$"),
    ("G", "Medical gas", r"^G-\d{3}$"),
]
