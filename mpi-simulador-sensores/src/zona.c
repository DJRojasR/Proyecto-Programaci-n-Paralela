#include "zona.h"
#include "config.h"
#include <stdio.h>
#include <string.h>

void zona_calcular_rango(int rank, int size, int total_sensores, int *inicio, int *fin) {
    int base = total_sensores / size;
    int resto = total_sensores % size;

    /* Los primeros `resto` procesos absorben 1 sensor extra cada uno,
     * para no dejar sensores sin asignar cuando la división no es exacta. */
    if (rank < resto) {
        *inicio = rank * (base + 1);
        *fin = *inicio + (base + 1);
    } else {
        *inicio = resto * (base + 1) + (rank - resto) * base;
        *fin = *inicio + base;
    }
}

ZonaId zona_desde_coordenadas(int x, int y) {
    int mitad_x = CIUDAD_ANCHO / 2;
    int mitad_y = CIUDAD_ALTO / 2;
    if (x < mitad_x && y < mitad_y) return ZONA_NORTE;
    if (x < mitad_x && y >= mitad_y) return ZONA_SUR;
    if (x >= mitad_x && y < mitad_y) return ZONA_ESTE;
    return ZONA_OESTE;
}

const char *zona_a_texto(ZonaId z) {
    switch (z) {
        case ZONA_NORTE: return "Norte";
        case ZONA_SUR:   return "Sur";
        case ZONA_ESTE:  return "Este";
        default:         return "Oeste";
    }
}

/* Región base (sin subdividir) de una de las 4 zonas con nombre. */
static void zona_region_base(ZonaId z, RegionGeografica *out) {
    int mitad_x = CIUDAD_ANCHO / 2;
    int mitad_y = CIUDAD_ALTO / 2;
    switch (z) {
        case ZONA_NORTE:
            out->x_min = 0; out->x_max = mitad_x;
            out->y_min = 0; out->y_max = mitad_y;
            snprintf(out->etiqueta, sizeof(out->etiqueta), "Norte");
            break;
        case ZONA_SUR:
            out->x_min = 0; out->x_max = mitad_x;
            out->y_min = mitad_y; out->y_max = CIUDAD_ALTO;
            snprintf(out->etiqueta, sizeof(out->etiqueta), "Sur");
            break;
        case ZONA_ESTE:
            out->x_min = mitad_x; out->x_max = CIUDAD_ANCHO;
            out->y_min = 0; out->y_max = mitad_y;
            snprintf(out->etiqueta, sizeof(out->etiqueta), "Este");
            break;
        default:
            out->x_min = mitad_x; out->x_max = CIUDAD_ANCHO;
            out->y_min = mitad_y; out->y_max = CIUDAD_ALTO;
            snprintf(out->etiqueta, sizeof(out->etiqueta), "Oeste");
            break;
    }
}

void zona_region_para_rank(int rank, int size, RegionGeografica *out) {
    int mitad_y = CIUDAD_ALTO / 2;

    if (size <= 1) {
        /* Un solo proceso: atiende toda la ciudad. */
        out->x_min = 0; out->x_max = CIUDAD_ANCHO;
        out->y_min = 0; out->y_max = CIUDAD_ALTO;
        snprintf(out->etiqueta, sizeof(out->etiqueta), "Ciudad");
        return;
    }

    if (size == 2) {
        /* Norte+Este (mitad superior, y < mitad) vs Sur+Oeste (mitad
         * inferior). Cada sensor conserva su zona real individual
         * (Norte/Sur/Este/Oeste) calculada por zona_desde_coordenadas. */
        out->x_min = 0; out->x_max = CIUDAD_ANCHO;
        if (rank == 0) {
            out->y_min = 0; out->y_max = mitad_y;
            snprintf(out->etiqueta, sizeof(out->etiqueta), "Norte+Este");
        } else {
            out->y_min = mitad_y; out->y_max = CIUDAD_ALTO;
            snprintf(out->etiqueta, sizeof(out->etiqueta), "Sur+Oeste");
        }
        return;
    }

    if (size == 4) {
        /* Un proceso por zona, en el orden pedido: 0=Norte,1=Sur,2=Este,3=Oeste */
        zona_region_base((ZonaId)rank, out);
        return;
    }

    if (size == 8) {
        /* 2 procesos por zona: cada uno atiende la mitad (en x) de esa zona. */
        int zona_base = rank / 2;
        int sub = rank % 2;
        RegionGeografica base;
        zona_region_base((ZonaId)zona_base, &base);

        int mitad_ancho = (base.x_max - base.x_min) / 2;
        out->y_min = base.y_min;
        out->y_max = base.y_max;
        if (sub == 0) {
            out->x_min = base.x_min;
            out->x_max = base.x_min + mitad_ancho;
        } else {
            out->x_min = base.x_min + mitad_ancho;
            out->x_max = base.x_max;
        }
        snprintf(out->etiqueta, sizeof(out->etiqueta), "%s%d", base.etiqueta, sub + 1);
        return;
    }

    /* Caso general (cualquier otro tamaño de size): reparte el ancho
     * de la ciudad en `size` franjas verticales iguales. No calza
     * exactamente con las 4 zonas con nombre, pero mantiene el
     * reparto geográfico (cada sensor sigue teniendo su zona real
     * calculada individualmente por coordenadas). */
    int ancho_franja = CIUDAD_ANCHO / size;
    out->x_min = rank * ancho_franja;
    out->x_max = (rank == size - 1) ? CIUDAD_ANCHO : out->x_min + ancho_franja;
    out->y_min = 0;
    out->y_max = CIUDAD_ALTO;
    snprintf(out->etiqueta, sizeof(out->etiqueta), "Franja%d", rank);
}