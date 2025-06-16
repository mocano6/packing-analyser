import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
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
          borderRadius: '20px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '15px',
            left: '15px',
            right: '15px',
            bottom: '15px',
            border: '3px solid white',
            borderRadius: '12px',
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
              left: '15px',
              right: '15px',
              height: '3px',
              backgroundColor: 'white',
              transform: 'translateY(-50%)',
            }}
          />
          {/* Środkowy krąg */}
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid white',
              borderRadius: '50%',
              backgroundColor: 'transparent',
            }}
          />
          {/* Linie podań - strzałki */}
          <div
            style={{
              position: 'absolute',
              top: '40px',
              left: '30px',
              width: '40px',
              height: '4px',
              backgroundColor: '#fbbf24',
              borderRadius: '2px',
              transform: 'rotate(30deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100px',
              right: '30px',
              width: '40px',
              height: '4px',
              backgroundColor: '#fbbf24',
              borderRadius: '2px',
              transform: 'rotate(-30deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '70px',
              left: '50px',
              width: '30px',
              height: '3px',
              backgroundColor: '#fbbf24',
              borderRadius: '2px',
              transform: 'rotate(60deg)',
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