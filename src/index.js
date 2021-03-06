import React, { PureComponent } from 'react'

import {
  StyleSheet,
  Text,
  View,
  Animated,
  PanResponder,
} from 'react-native'

const clamp = (value, min, max) => Math.max(Math.min(min, value), max)

const SWIPE_THRESHOLD = 120

class SwipableCards extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      pan: new Animated.ValueXY(),
      enter: new Animated.Value(0.5),
      card: this.props.cards[0],
      currentCardIdx: 0,
    }
  }

  log = (...args) => {
    this.props.logger(...args)
  }

  _goToNextCard() {
    let newIdx = this.state.currentCardIdx + 1

    // Checks to see if last card.
    // If props.loop=true, will start again from the first card.
    newIdx = newIdx > this.props.cards.length - 1
      ? this.props.loop ? 0 : -1
      : newIdx

    this.setState({
      card: this.props.cards[newIdx],
      currentCardIdx: newIdx,
    })
  }

  componentDidMount() {
    this._animateEntrance()
  }

  _animateEntrance() {
    Animated.spring(
      this.state.enter,
      { toValue: 1, friction: 8 }
    ).start()
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.cards && nextProps.cards.length > 0 && this.props.cards !== nextProps.cards) {
      this.setState({
        card: nextProps.cards[0],
        currentCardIdx: 0,
      })
    }
  }

  componentWillMount() {
    const onPanResponderMove = this.props.onlyHorizontal ?
      Animated.event([ null, {dx: this.state.pan.x} ]) :
      Animated.event([ null, {dx: this.state.pan.x, dy: this.state.pan.y} ])

    this._panResponder = PanResponder.create({
      onResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onMoveShouldSetPanResponder: (evt, { dx }) => !this.props.disableGestures && Math.abs(dx) > 5,

      onPanResponderTerminate: () => {
        this._backToDeck()
      },

      onPanResponderGrant: () => {
        this.state.pan.setOffset({x: this.state.pan.x._value, y: this.state.pan.y._value})
        this.state.pan.setValue({x: 0, y: 0})
      },

      onPanResponderMove,

      onPanResponderRelease: (e, {vx, vy}) => {
        this.state.pan.flattenOffset()
        let velocity

        if (vx >= 0) {
          velocity = clamp(vx, 3, 5)
        } else if (vx < 0) {
          velocity = clamp(vx * -1, 3, 5) * -1
        }

        const regret = vx * this.state.pan.x._value < 0
        if (Math.abs(this.state.pan.x._value) > SWIPE_THRESHOLD && !regret) {
          this.state.pan.x._value > 0
            ? this.props.handleYup(this.state.card)
            : this.props.handleNope(this.state.card)

          this.props.onCardRemoved(this.props.cards.indexOf(this.state.card))

          Animated.timing(this.state.pan, {
            toValue: { x: velocity * 200, y: vy * 200},
            duration: 200,
          }).start(this._resetState)
        } else {
          this._backToDeck()
        }
      }
    })
  }

  _backToDeck = () => {
    Animated.spring(this.state.pan, {
      toValue: {x: 0, y: 0},
      friction: 4,
    }).start()
  }

  _resetState = () => {
    this.state.pan.setValue({x: 0, y: 0})
    this.state.enter.setValue(0)
    this._goToNextCard()
    this._animateEntrance()
  }

  renderNoMoreCards() {
    return this.props.renderNoMoreCards()
  }

  renderFirstCard(card, cardIndex) {
    const { pan, enter } = this.state

    const [translateX, translateY] = [pan.x, pan.y]

    const rotate = pan.x.interpolate({inputRange: [-200, 0, 200], outputRange: ['-30deg', '0deg', '30deg']})
    const scale = !this.props.stack
      ? enter : this.state.enter.interpolate({inputRange: [0, 1], outputRange: [card.lastScale || 1, 1]})

    const animatedCardstyles = {transform: [{translateX}, {translateY}, {rotate}, {scale} ]}

    if (this.props.fadeOnSwipe) {
      animatedCardstyles.opacity = pan.x.interpolate({inputRange: [-200, 0, 200], outputRange: [0.5, 1, 0.5]})
    }

    return (
      <Animated.View
        key={cardIndex}
        style={[this.props.cardStyle, animatedCardstyles ]}
        {...this._panResponder.panHandlers}
      >
        {this.props.renderCard(card)}
      </Animated.View>
    )
  }

  renderStackCard(card, style, cardIndex) {
    return (
      <Animated.View
        key={cardIndex}
        style={[this.props.cardStyle, style]}
      >
        {this.props.renderCard(card)}
      </Animated.View>
    )
  }

  renderStack() {
    const { currentCardIdx } = this.state
    const { cards, stackDepth } = this.props

    return Array(stackDepth).fill().map((_, i) => {
      // Render last card first
      const cardIndex = currentCardIdx + (stackDepth - 1) - i
      const card = cards[cardIndex]

      if (cardIndex === currentCardIdx) {
        return card && this.renderFirstCard(card, cardIndex)
      }

      let offsetX = this.props.stackOffsetX * (cards.length - i)
      let lastOffsetX = offsetX + this.props.stackOffsetX

      let offsetY = this.props.stackOffsetY * (cards.length - i)
      let lastOffsetY = offsetY + this.props.stackOffsetY

      let style = {
        position: 'absolute',
        top: this.state.enter.interpolate({inputRange: [0, 1], outputRange: [lastOffsetY, offsetY]}),
        left: this.state.enter.interpolate({inputRange: [0, 1], outputRange: [lastOffsetX, offsetX]}),
        elevation: i * 10
      }

      return card && this.renderStackCard(card, style, cardIndex)
    })
  }

  render() {
    let { pan } = this.state

    let yupOpacity = pan.x.interpolate({inputRange: [0, 150], outputRange: [0, 1]})
    let yupScale = pan.x.interpolate({inputRange: [0, 150], outputRange: [0.5, 1], extrapolate: 'clamp'})
    let animatedYupStyles = {transform: [{scale: yupScale}], opacity: yupOpacity}

    let nopeOpacity = pan.x.interpolate({inputRange: [-150, 0], outputRange: [1, 0]})
    let nopeScale = pan.x.interpolate({inputRange: [-150, 0], outputRange: [1, 0.5], extrapolate: 'clamp'})
    let animatedNopeStyles = {transform: [{scale: nopeScale}], opacity: nopeOpacity}

    return (
      <View style={this.props.containerStyle}>
        { this.state.card ? this.renderStack() : this.renderNoMoreCards() }

          { this.props.renderNope
            ? this.props.renderNope(pan)
            : (
                this.props.showNope
                ? (
                  <Animated.View style={[this.props.nopeStyle, animatedNopeStyles]}>
                      {this.props.nopeView
                          ? this.props.nopeView
                          : <Text style={this.props.nopeTextStyle}>{this.props.nopeText}</Text>
                      }
                  </Animated.View>
                  )
                : null
              )
          }

          { this.props.renderYup
            ? this.props.renderYup(pan)
            : (
                this.props.showYup
                ? (
                  <Animated.View style={[this.props.yupStyle, animatedYupStyles]}>
                    {this.props.yupView
                      ? this.props.yupView
                      : <Text style={this.props.yupTextStyle}>{this.props.yupText}</Text>
                    }
                  </Animated.View>
                )
                : null
              )
          }
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yup: {
    borderColor: 'green',
    borderWidth: 2,
    position: 'absolute',
    padding: 20,
    bottom: 20,
    borderRadius: 5,
    right: 20,
  },
  yupText: {
    fontSize: 16,
    color: 'green',
  },
  nope: {
    borderColor: 'red',
    borderWidth: 2,
    position: 'absolute',
    bottom: 20,
    padding: 20,
    borderRadius: 5,
    left: 20,
  },
  nopeText: {
    fontSize: 16,
    color: 'red',
  }
})

SwipableCards.propTypes = {
  cards: React.PropTypes.array,
  loop: React.PropTypes.bool,
  onlyHorizontal: React.PropTypes.bool,
  stack: React.PropTypes.bool,
  showYup: React.PropTypes.bool,
  showNope: React.PropTypes.bool,
  yupView: React.PropTypes.element,
  yupText: React.PropTypes.string,
  nopeView: React.PropTypes.element,
  nopeText: React.PropTypes.string,
  containerStyle: View.propTypes.style,
  cardStyle: View.propTypes.style,
  yupStyle: View.propTypes.style,
  yupTextStyle: Text.propTypes.style,
  nopeStyle: View.propTypes.style,
  nopeTextStyle: Text.propTypes.style,
  stackDepth: React.PropTypes.number,
  stackOffsetX: React.PropTypes.number,
  stackOffsetY: React.PropTypes.number,
  fadeOnSwipe: React.PropTypes.bool,
  handleYup: React.PropTypes.func,
  handleNope: React.PropTypes.func,
  onCardRemoved: React.PropTypes.func,
  renderCard: React.PropTypes.func,
  renderYup: React.PropTypes.func,
  renderNope: React.PropTypes.func,
  disableGestures: React.PropTypes.bool,
  renderNoMoreCards: React.PropTypes.func,
  logger: React.PropTypes.func,
}

SwipableCards.defaultProps = {
  cards: [],
  loop: false,
  onlyHorizontal: false,
  showYup: true,
  showNope: true,
  containerStyle: styles.container,
  yupStyle: styles.yup,
  yupText: 'Yup!',
  yupTextStyle: styles.yupText,
  nopeStyle: styles.nope,
  nopeText: 'Nope!',
  nopeTextStyle: styles.nopeText,
  stack: true,
  stackDepth: 2,
  stackOffsetX: 0,
  stackOffsetY: 0,
  fadeOnSwipe: false,
  disableGestures: false,
  renderNoMoreCards: () => <View />,
  onCardRemoved: () => null,
  logger: () => null,
}

export default SwipableCards
