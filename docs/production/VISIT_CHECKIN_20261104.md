# Visit check-in account boundary

The native Visits screen previously awaited the location permission prompt and GPS, then started its API mutation using whichever session was current at that later moment. An account/firm/role change during either await could attach the earlier device read to the wrong session's request.

The shared check-in operation now captures the initiating account context before the OS prompt, checks it after permission and GPS, and supplies that same context to the HTTP mutation. Permission denial performs no GPS read or mutation. The screen checks the context before cache refresh and the success notice. The API continues to enforce current visit ownership independently.

Four native boundary tests passed: firm change during permission, firm change during GPS, permission denial and one successful owned mutation with the exact returned coordinates. OS/GPS are stubbed; no phone/location accuracy test is implied. Native typecheck passed and scoped lint has zero errors/six warnings. This source is after the pinned Build53 candidate and awaits a subsequent signed release and installed-device validation.
