import { ImageResponse } from 'next/og'

export const size = {
  width: 192,
  height: 192,
}
export const contentType = 'image/png'

export default function Icon192() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#22c55e',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '24px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            bottom: '16px',
            border: '4px solid white',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Środkowa linia boiska */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '16px',
              right: '16px',
              height: '4px',
              backgroundColor: 'white',
              transform: 'translateY(-50%)',
            }}
          />
          {/* Środkowy krąg */}
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid white',
              borderRadius: '50%',
              backgroundColor: 'transparent',
            }}
          />
          {/* Linie podań - strzałki */}
          <div
            style={{
              position: 'absolute',
              top: '44px',
              left: '32px',
              width: '48px',
              height: '6px',
              backgroundColor: '#fbbf24',
              borderRadius: '3px',
              transform: 'rotate(30deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '110px',
              right: '32px',
              width: '48px',
              height: '6px',
              backgroundColor: '#fbbf24',
              borderRadius: '3px',
              transform: 'rotate(-30deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '76px',
              left: '56px',
              width: '36px',
              height: '4px',
              backgroundColor: '#fbbf24',
              borderRadius: '2px',
              transform: 'rotate(60deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '76px',
              right: '56px',
              width: '36px',
              height: '4px',
              backgroundColor: '#fbbf24',
              borderRadius: '2px',
              transform: 'rotate(-60deg)',
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
} 