export class AppError extends Error {
  constructor(message: string) {
    // call the super class constructor
    super(message)
    // set the name property to the class name
    this.name = this.constructor.name
    // set the prototype explicitly to preserve the instanceof operator
    Object.setPrototypeOf(this, AppError.prototype)
  }

    static beyondMaxTrackLevel = new AppError('beyond max track level');
    static addressAlreadyTracked = new AppError('address already tracked')
    static workerPoolTerminating = new AppError('workerpool is terminating')
}
