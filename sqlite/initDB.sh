#!/bin/bash

make
printf "CREATE TABLE rsvp (id TEXT PRIMARY KEY, name TEXT, attending_reception INTEGER default 0, attending_sealing INTEGER default 0, reception_guest_count INTEGER, sealing_guest_count INTEGER, time INTEGER);\n0\n" | ./sqlite dr_db.sqlite
printf "CREATE TABLE stats (id INTEGER PRIMARY KEY, method TEXT, path TEXT, ip TEXT, time INTEGER);\n0\n" | ./sqlite dr_db.sqlite
