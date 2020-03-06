#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include "sqlite3.h"

#define QUIT    '0'
#define NULL_VALUE  "(null)"

int callback(void*, int, char**, char**);
void failure(char*);
void statementFail(sqlite3_stmt*, char**, int);
void query(char*);
void quit(int);
void sigIntHandler(int);

sqlite3 *db;

int main(int argc, char **argv)
{
    char *line;
    int r;
    size_t n;

    db = NULL;

    signal(SIGINT, sigIntHandler);

    if (argc != 2)
    {
        failure("Usage: sqlite_interface [DB_FILENAME]");
        quit(1);
    }

    r = sqlite3_open(argv[1], &db);
    if (r)
    {
        failure((char*) sqlite3_errmsg(db));
        quit(1);
    }

    while (1)
    {
        line = NULL;
        n = 0;
        if (getline(&line, &n, stdin) <= 0)
        {
            free(line);
            continue;
        }

        if (line[0] == QUIT)
        {
            free(line);
            quit(0);
        }

        query(line);

        printf("QUERY\n");
        fflush(stdout);

        free(line);
    }
}

void failure(char *errmsg)
{
    printf("FAIL\n%s\n", errmsg);
}

void query(char *sql)
{
    char *params[10];
    char *tmp;
    const char *value;
    const char *column;
    sqlite3_stmt *statement;
    int i, j, r, params_count, columns_count;
    size_t n;

    i = 0;
    params_count = 0;
    while (sql[i] != '\0')
    {
        if (sql[i] == '?')
        {
            n = 0;
            tmp = NULL;
            getline(&tmp, &n, stdin); 

            j = 0;
            while (tmp[j] != '\0')
            {
                if (tmp[j] == '\n')
                {
                    tmp[j] = '\0';
                    break;
                }

                j++;
            }

            params[params_count] = tmp;
            params_count++;
        }
        i++;
    }

    if (sqlite3_prepare_v2(db, sql, -1, &statement, NULL) != SQLITE_OK)
    {
        failure("Failed to prepare sql statement");

        for (i = 0; i < params_count; i++) free(params[i]);

        return;
    }

    for (i = 0; i < params_count; i++)
    {
        sqlite3_bind_text(statement, i+1, params[i], -1, free);
    }

    while (sqlite3_step(statement) == SQLITE_ROW)
    {
        columns_count = sqlite3_column_count(statement);

        for (i = 0; i < columns_count; i++)
        {
            column = sqlite3_column_name(statement, i);
            printf("%s\n", column ? column : NULL_VALUE);

            value = sqlite3_column_text(statement, i);
            printf("%s\n", value ? value : NULL_VALUE);
        }

        printf("ROW\n");
    }

    sqlite3_finalize(statement);
}

void quit(int ret)
{
    printf("END\n");
    fflush(stdout);

    if (db)
    {
        sqlite3_close(db);
    }

    exit(ret);
}

void sigIntHandler(int signal)
{
    quit(0);
}
