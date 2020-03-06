#!/bin/bash

make
printf "CREATE TABLE rsvp (id TEXT PRIMARY KEY, email TEXT, name TEXT, attending_reception INT default 0, attending_sealing INT default 0, reception_guest_count INT, sealing_guest_count INT, ip TEXT);\n0\n" | ./sqlite dr_db.sqlite
printf "CREATE TABLE stats (id ROWID, path TEXT, ip TEXT);\n0\n" | ./sqlite dr_db.sqlite
