CC = mpicc
CFLAGS = -Wall -Wextra -O2 -Iinclude -pthread
LDFLAGS = -lmosquitto -pthread

SRC = src/main.c src/sensor.c src/zona.c src/mqtt_publisher.c src/control.c
OBJ = $(SRC:.c=.o)
BIN = bin/simulador

all: $(BIN)

$(BIN): $(OBJ)
	@mkdir -p bin
	$(CC) $(OBJ) -o $(BIN) $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJ) $(BIN)

.PHONY: all clean
