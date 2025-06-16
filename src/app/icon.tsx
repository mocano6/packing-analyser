import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: '6px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '3px',
            left: '3px',
            right: '3px',
            bottom: '3px',
            border: '1px solid white',
            borderRadius: '3px',
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
              left: '3px',
              right: '3px',
              height: '1px',
              backgroundColor: 'white',
              transform: 'translateY(-50%)',
            }}
          />
          {/* Środkowy krąg */}
          <div
            style={{
              width: '8px',
              height: '8px',
              border: '1px solid white',
              borderRadius: '50%',
              backgroundColor: 'transparent',
            }}
          />
          {/* Linie podań - strzałki */}
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '6px',
              width: '8px',
              height: '1px',
              backgroundColor: '#fbbf24',
              transform: 'rotate(30deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '6px',
              width: '8px',
              height: '1px',
              backgroundColor: '#fbbf24',
              transform: 'rotate(-30deg)',
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